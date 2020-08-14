/*
 * Xprsso
 * Copyright(c) 2020 Danny Vidal
 * MIT Licensed
 */

var { graphql, buildSchema } = require("graphql");
var { EventEmitter } = require("events");
var { Router } = require("express");
var fs = require("fs");

function Xprsso() {
  var descriptorTable = {
    "@param": function handleParam(value, args) {
      var valueOrig = value.split(":")[0];
      //value comes in as id: here im converting to _colon_id 
      value = value.replace(regexTable._colon_.rgx, " _colon_").split(" ");
      {let x = value[0], y = value[1]; value = [y, x].join("")}
      //parsing arguments
      let argsArr = args
        .replace(regexTable._colon_.rgx, "")
        .replace(/\s/gi, "")
        .replace(/\-\>/gi, " ")
        .trim()
        .split(" ");
        
      let invalidToken = check4InvalidSyntax(argsArr, /([^a-zA-Z0-9])/gi);
      //we should allow for a maximum of two callbacks to be used
      if (invalidToken) {

        throw SyntaxError(`Error parsing @param ${valueOrig} invalid token ${invalidToken}`);

      } else {

        return { value: valueOrig, lookupKey: value, callStack: argsArr };

      }
    },
  };
  var regexTable = {
    _slash_: { rgx: /\//gi, value: "/" },
    _backslash_: { rgx: /\\/gi, value: "\\" },
    _colon_: { rgx: /\:/gi, value: ":" },
    _carrot_: { rgx: /\^/gi, value: "^" },
    _dollar_: { rgx: /\$/gi, value: "$" },
    _dot_: { rgx: /\./gi, value: "." },
    _asterisk_: { rgx: /\*/gi, value: "*" },
    _leftperen_: { rgx: /\(/gi, value: "(" },
    _rightperen_: { rgx: /\)/gi, value: ")" },
    _leftbracket_: { rgx: /\[/gi, value: "[" },
    _rightbracket_: { rgx: /\]/gi, value: "]" },
    _questionmark_: { rgx: /\?/gi, value: "?" },
    _addition_: { rgx: /\+/gi, value: "+" },
    //TODO Left and right bracket is tricky because graphql needs them for subfields
  };

/**
 * map holds the keys of the express paths such as / or /api
 * each map points to its own innermap each innermap contains 
 * HTTP Verbs such as GET POST etc that point to the taskmap 
 * each task map contains the names of tasks created with this.addtask
 * 
 */
  
  var methods = ["GET", "POST", "DELETE", "PUT", "PATCH"];
  var map = new NullOBJ;
  var innerMap = new NullOBJ;
  var taskmap = new NullOBJ;

  this.paths = new NullOBJ;
  this.tasks = new NullOBJ;
  this.params = new NullOBJ;
  
  var schema = null;
  
  
  for (let i of methods) {
    innerMap[i] = taskmap;
  }
  // binding functions to keep them prvate but keep its 'this' value
  var updateSchema = updateSchema.bind(this);
  var parseAtDescriptors = parseAtDescriptors.bind(this);

  /**
   * @param {Function} middleware express middleware function it cannot be an anonymous function
   */
  this.addTask = function addTask(middleware) {
    { let mType = typeof middleware;

      if (mType !== "function") {
        throw TypeError(
          `Express middleware must be typeof 'function' instead recieved ${mType}`
        );
      }
      var name = middleware.name;
      if (!name) {
        throw TypeError("Express middleware function cannot be anonymous");
      }
    }
    if (name in taskmap) {
      throw TypeError(`a mniddleware function of ${name} already exists`);
    }
    taskmap[name] = name;
    this.tasks[name] = middleware;
    updateSchema();
    return this;
  };

  /**
   *
   * @param {Object} app express application
   * @param {String} query gql query
   */
  this.set = function set(app, query) {
    var query = makeGqlCompatible(query);
    var paths = query.match(/(_[a-zA-Z])\w+/g);
    if(!paths){
      throw Error("Missing express paths");
    }
    for (let path of paths) {
      // if path starts and ends with a slash we should treat it as a regular expression
      if (path.match(/^_slash_.*_slash_$/)) {
        //convert back to express compatible path  EG. _slash_ -> /
        this.paths[path] = new RegExp(format(path, { regexParam: true }));
      } else {
        this.paths[path] = format(path);
      }
    }
    updateSchema();
    //each path eg /api -> _slash_api gets its own innermap map[_slash_api]{ GET POST .... }
    for (let path of Object.keys(this.paths)) {
      map[path] = innerMap;
    }
    graphql(buildSchema(schema), query, map).then(
      function afterQuery(value) {
        if (value.errors) {
          console.error(value.errors);
        } else {
          var { data } = value;
          var paths = Object.keys(data);
          var params = Object.keys(this.params);
          for (let path of paths) {
            var router = Router();
            //determine if router.param should be used
            params.forEach(function check4ParamPathMatch(lookupKey) {
              if (path.includes(lookupKey)) {
                let args = this.params[lookupKey].callStack;
                let param = this.params[lookupKey].value;
                for(let i = 0; i < args.length; ++i){
                  router.param(param, this.tasks[args[i]]);
                }
              }
            }, this);

            for (let method of Object.keys(data[path])) {
              router.route(this.paths[path])
              [method.toLowerCase()](
                ...Object.keys(data[path][method]).map((k) => this.tasks[k])
              );
              app.use(router);
            }
          }
          return void this.emit("ready");
        }
      }.bind(this)
    );
    return this;
  };

  /**
   * @description re assigns schema to include map entries and include new types
   * which will be express mounting points which will point to map
   */
  function updateSchema() {
    var queries = gqlFields(Object.keys(this.paths), "map");
    var innerMapTypes = gqlFields(Object.keys(innerMap), "task");
    var taskTypes = gqlFields(Object.keys(this.tasks), "String");
    schema = `
            type Query {
                map: map
                ${queries}
            }
            type map {
                ${innerMapTypes}
            }
            type task {
                ${taskTypes}
            }
        `;
    return void 0;
  }

  /**
   *
   * @param {Array<String>} keys keys to iterate over
   * @param {String} type the gql type each key will point to
   */
  function gqlFields(keys, type) {
    if (!Array.isArray(keys)) {
      throw TypeError("keys is not an array");
    } else if (typeof type !== "string") {
      throw TypeError("type is not a string");
    } else {
      return keys
        .map(function formatGqlFields(key) {
          return `${key}: ${type}`;
        })
        .join("\t\n");
    }
  }

  /**
   * @description return null proto object
   */
  function NullOBJ() {
    return Object.create(null);
  }

  /**
   * @description converts express mount paths into gql compatible strings  EG. / -> _slash_
   * @param  query a gql query
   */
  function makeGqlCompatible(query) {
    if(query.trim() == ""){
      throw Error("Missing query");
    }
    query = removeComments(query);
    query = parseAtDescriptors(query);
    for (let key of Object.keys(regexTable)) {
      query = query.replace(regexTable[key].rgx, key);
    }
    return query;
  }


  function format(source, config) {
    if (config && config.regexParam) {
      source = source.replace(/_slash_/gi, "");
    }
    for (let key of Object.keys(regexTable)) {
      source = source.replace(new RegExp(key, "ig"), regexTable[key].value);
    }
    return source;
  }


  function parseAtDescriptors(query) {
    var descriptors = query.match(/@.*/g);
    if (descriptors) {
      for (let i of descriptors) {
        let descriptor = i.match(/@\w+.*:/);
        let args = i.match(/:\s.*/);
        if (!args) {
          throw TypeError(`${descriptor} missing arguments`);
        }

        if (descriptor) {
          descriptor = descriptor[0];
          let [method, val] = descriptor.split(" ");

          if (method in descriptorTable) {
            let { lookupKey, value, callStack } = descriptorTable[method](val,args[0]);
            this.params[lookupKey] = { value, callStack };
          }
        }
      }
    }
    return query.replace(/@.*/g, "");
  }


  function check4InvalidSyntax(arr, test) {
    for (let i of arr) {
      var invalid = i.match(test);
      if (invalid) {
        return invalid[0];
      }
    }
    return null;
  }
  function removeComments(query){
    return query.replace(/.*#.*/gm, "");
  }
}

/**
 * @static
 * @param {String} path the path of the queryFile;
 * @description get query from file
 */
Xprsso.fromFile = function fromFile(path) {
  return fs.readFileSync(path).toString("utf-8");
};

Xprsso.prototype = Object.create(new EventEmitter);

module.exports = Xprsso;
