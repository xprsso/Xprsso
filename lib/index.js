/*
 * Xprsso
 * Copyright(c) 2020 Danny Vidal
 * MIT Licensed
 */

var fs = require("fs");
var path = require("path");
var { graphql, buildSchema } = require("graphql");
var { EventEmitter } = require("events");
var express = require("express");
var {
    makeExpressPath,
    makeGQLCompatible,
    parseGQLPaths,
    parseDescriptors,
    isES6Func
} = require("./regex");



function Xprsso() {
    //for relating graphs to logic
    //the graphs here are JUST  strings in objects
    //they are also used as object keys
    const pathsGraph = new NullObject;
    const verbsGraph = new NullObject;
    const tasksGraph = new NullObject;
    /**
     *(pathsGraph[ _slash_api] aka /api converted)
     *                 |
     *       [GET] (verbsGraph) [POST] [etc..]
     *                 |                
     *              [tasksGraph] <- function names of tasks added with addTask
     */


    ["GET", "POST", "DELETE", "PUT", "PATCH"]
    .forEach(function addVerbs(method) {
        //each VERB has a reference to tasksGraph
        //this exposes ALL task NAMES to each VERB's subfield
         verbsGraph[method] = tasksGraph;
    });


    
    //sharedThis is the 'this' value shared between all tasks 
    this.schema = null;
    this.descriptors = new NullObject;
    this.sharedThis = new NullObject;
    this.options = new NullObject;
    this.params = new NullObject;
    this.paths  = new NullObject;
    this.tasks  = new NullObject;
    

    this.descriptors.param = function(router, value, args){
        let middleware = args.map(getTask, this);

        for(let m of middleware){
            router.param(value, m.bind(this.sharedThis));
        }
        
        return void 0;
    };

    this.descriptors.static = function(app, value, args){
        let options = getExpressOptions.call(this, value);
        let [expressPath, root] = args;
        if(expressPath === undefined ) {
            throw Error("@static expressPath is undefined");
        } 
        if(root === undefined ){
            throw Error("@static root is undefined");
        }
        app.use(expressPath, express.static(path.join(process.cwd(), root),  options));
        return void 0;
    };
    
    this.descriptors.all = function(app, value, args){
        let middleware = args.map(getTask, this);
        app.all(value, ...middleware.map(f => f.bind(this.sharedThis)));
        return void 0;
    };


    //convert express middlware into useable @descriptors
    ;["json", "raw", "text", "urlencoded"]
    .forEach(function addExpressDescriptors(k){
        this.descriptors[k] = function(app, value){
            let options = getExpressOptions.call(this, value);
            app.use(express[k](options));
            return void 0;
        }.bind(this);
            return void 0;
    }, this);

    /**
     * @description adds a task AKA middleware to internal 
     * tasks and exposes its name to GraphQL via tasksGraph
     * @returns {this} this, can be chained
     * @throws TypeError if name property does not exist on function
     * @param {function} mw middleware function 
     */
    this.addTask = function addTask(mw){
        var mType = typeof mw;
        if(mType !== "function"){
            throw TypeError(`Express Middleware must be typeof 'function' instead recieved ${mType}`);
        }
        var name = mw.name;
        if(!name){
            throw TypeError("Express Middleware function cannot be anonymous");
        }
        if(name in tasksGraph){
            throw Error(`Task with the name ${name} already exists`);
        }
        tasksGraph[name] = name;
        this.tasks[name] = mw;
       
        updateGQLSchema.call(this);
        return this;
    }


    /**
     * @returns {void} void
     * @description adds options for for express middlware
     * @param {String} name name of the options 
     * @param {object} options options for express middleware
     */
    this.addOptions = function addOptions(name, options){
        validateArgs(name, options);
        this.options[name] = options;
        return void 0;
        function validateArgs(name, options){
            if(typeof name !== "string"){
                throw TypeError("addOptions requires a name that is a typeof string");
            }
            if(!options){
                throw Error("addOptions missing options");
            }
        }
    }
    /**
     * 
     * @returns {void} void
     * @description adds a descriptor hook to use within the query
     * @param {{name:String, hook:Function}} options name and a hook function
     */
    this.addDescriptor = function addDescriptor(options){
        options = validateOptions.call(this, options);
        this.descriptors[options.name] = options.hook.bind(this);

        function validateOptions(options){
            if(!(options)){
                throw Error("addDescriptor requires options");
            }else if(!(typeof options.name == "string" && options.name.trim().length > 0)){
                throw TypeError("addDescriptors options require a name property and for that name to be typeof string");
            }else if(!(options.hook) || typeof options.hook !== "function"){
                throw TypeError("addDescriptors options require a hook property and for that hook to be typeof function");
            }else if(isES6Func(options.hook)){
                throw TypeError("addDescriptors hooks must be regular function expressions instead found () => {...}")
            }else if(options.name in this.descriptors){
                throw Error(`Xprsso tried to add a descriptor but ${options.name} already exists`)
            }else{
                return options;
            }
        }
        return void 0;
    }
    /**
     * @description set the query and internally calls applyQuery
     * @returns {void} void
     * @param {Express.Application} app an express application
     * @param {String} str could be file path or a query
     */
    this.set = function set(app, str) {
        validateExpressApp(app);
        var query = getQuery(str);
        var descriptors = parseDescriptors(query);
        query = makeGQLCompatible(query);

        var paths = parseGQLPaths(query);
        for(let path of paths){
            pathsGraph[path] = verbsGraph;
            this.paths[path] = makeExpressPath(path);      
        }

        //update the schema before finally using the query
        updateGQLSchema.call(this);
    
        graphql(buildSchema(this.schema), query, pathsGraph)
        .then(function afterQuery(value){
            if(value.errors){
                for(let error of value.errors){
                  console.error(makeExpressPath(error.message));
                }
                throw Error("Could not query internal graph");
            }
            var { data:queryResult } = value;

            return void applyQuery.call(this, app, queryResult, descriptors);

        }.bind(this))
        return this;


        /**
         * @description  try to resolve str as path for file 
         * as query if it does not exist use str itself as query
         * @throws Error when str used as a path.resolve 
         * arg but failed with an exit code other than "ENOENT"
         * @throws TypeError if str arg is not a string
         * @returns {String} a query string
         * @param {String} str  string that will be a 
         * query or used as the resolve path to a query file
         */
        function getQuery(str){
            if(typeof str !== "string"){
                throw TypeError("getQuery must be typeof string");
            }
           
            try{
                str = fs.readFileSync(str, {encoding:"utf-8"})
            }catch(error){
                if(error.code !== "ENOENT"){
                    throw error;
                }
            }
            return str;
        }
    }



    /**
     * @description performs logic on the queryResult
     * @emits "ready"
     * @returns {void} void
     * @param {Express.Application} app an express application
     * @param {object} queryResult the result of the query
     * @param {Array<{dName:String, dValue:String, dArgs:Array<String>}>} descriptors  
     * an array of parsed and ready to use descriptor object
     */
    function applyQuery(app, queryResult, descriptors){
        fireDescriptorHooks.call(this, descriptors, app);
        createRouters.call(this, app, queryResult); 
        return void this.emit("ready");
    }



    /**
     * @description calls descriptor hooks base of their name
     * if the name is param it insteads adds a property to this.params
     * to be used later in createRouters.
     * @returns {void} void
     * @throws Error if dName does not exist on this.descriptors
     * @param {Array<{dName:String, dValue:String, dArgs:Array<String>}>} descriptors  
     * an array of parsed and ready to use descriptor object
     * @param {Express.Application} app an express application
     */
    function fireDescriptorHooks(descriptors, app){
        if(descriptors){
            for(let {dName, dValue, dArgs} of descriptors){

                if(!(dName in this.descriptors)){
                    throw Error(`There are no hooks provided for ${dName}`);
                }else if(dName !== "param"){
                    this.descriptors[dName].call(this, app, dValue, dArgs);
                }else{
                    //params are handled at the router level. in createRouters
                    this.params["_colon_" + dValue] = {value:dValue, args:dArgs};;
                }
            }
        }
        
        return void 0;
    }




    /**
     * @returns {void} void
     * @description creates new routers and adds them to express app
     * it also add router level params
     * @param {Express.Application} app an express application
     * @param {object} queryResult the result of the query
     */
    function createRouters(app, queryResult){    
        
        var keys = Object.keys;

        for(let path of keys(queryResult)){
            var router = express.Router(this.routerOptions);

            //check for param descriptor and applies it to the router
            keys(this.params)
            .forEach(function handleParamDesc(param){
               if(path.includes(param)){
                   let {value, args} = this.params[param];
                   this.descriptors.param.call(this, router, value, args)
               }
            }.bind(this));
            
            let parsedPath = this.paths[path]; 
            for(let verb of keys(queryResult[path])){
                let method = verb.toLowerCase();     
                /**
                 * method will be get post delete etc.
                 * parsedPath will be / or /api etc.
                 * so here we are mapping the queried 
                 * task names and returning the function reference
                 * created by addTask. Then we are spreading it
                 * into an express router.
                 * What it would look like if one were to do 
                 * this manually is like so:
                 router.route("/").post(...[foo, bar, baz]);
                 foo bar baz being the middleware functions.
                 */
                router.route(parsedPath)[method]
                (...keys(queryResult[path][verb])
                .map(getTask, this));
                app.use(router);
            }
        }
        return void 0;
    }





    /**
     * @returns {void} void
     * @description creates and re-assigns a GraphQL schema
     */
    function updateGQLSchema(){
        var keys = Object.keys;
        var pathQueries = createGQLFields(keys(pathsGraph), "path");
        var verbTypes = createGQLFields(keys(verbsGraph), "task");
        var taskTypes = createGQLFields(keys(tasksGraph), "String");
        
        this.schema = `
                type Query {
                    path: path
                    ${pathQueries}
                }
                type path {
                    ${verbTypes}
                }
                type task {
                    ${taskTypes}
                }
        `; return void 0;




    
        /**
         * @returns {Array<String>} an aray of GraphQl compatible fields
         * @throws {TypeError} if keys arg is not an array
         * or if type arg is not a typeof string
         * @description helper function to create GraphQL Schema fields
         * @param {Array<String>} keys an array of GraphQL fields
         * @param {String} type GraphQL type that each key should point to
         */
        function createGQLFields(keys, type){
            if (!Array.isArray(keys)) {
                throw TypeError("keys should be an array");
            } 
            if (typeof type !== "string") {
                throw TypeError("type should be a string");
            }
            return keys.map(key =>`${key}: ${type}`).join("\t\n");     
        }
    }


    /**
     * @throws {TypeError} if the names of all keys in a newly created 
     * express app dont match the function argument
     * @throws {TypeError} if the app is undefined or not a function
     * @returns {void} void
     * @description checks to see if argument is an express app
     * @param {Express.Application} app  an express application
     */
    function validateExpressApp(app){
        if(!app || typeof app !== "function"){
            throw TypeError("Xprsso expected an express application");
        }
        let keys = Object.keys(express());
        for(let key of keys){
            if(!(key in app)){
                throw TypeError("Xprsso expected an express application");
            }
        }
        return void 0;
    }




    /**
     * @returns {null | object} null or the object created by addOptions
     * @description returns the options by their name added by addOptions
     * @param {String} name the name of the options object
     */
    function getExpressOptions(name){
        if(name in this.options){
            return this.options[name]
        }
        // console.warn(`could not find options with the name ${name}`);
        return null;
    }




    /**
     * @returns {Function} a middlware function created by addTask
     * @throws Error if  fName does not exist in this.tasks
     * @description get function references from task based on their names
     * @param {String} fName 
     */
    function getTask(fName){
        if(!(fName in this.tasks)){
            throw Error(`Could not find ${fName} in tasks`);
        }
        return this.tasks[fName].bind(this.sharedThis);
    }



    /**
     * @returns {object} null prototype object
     * @description returns a null proto object
     */
    function NullObject(){
        var o = Object.create(null)
        return o;
    }
}

Xprsso.prototype = Object.create(new EventEmitter);

module.exports = Xprsso;