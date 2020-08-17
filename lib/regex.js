/**
* For use of coverting characters which would otherwise 
* throw syntax errors, into GQL safe strings.
*/
var RgxTable = Object.create(null);
Object.defineProperty(RgxTable, Symbol.iterator, {
    enumerable: false,
    writable: false,
    value: function* () {
        let keys = Object.keys(this);
        for (let key of keys) {
            yield key;
        }
    }
})
RgxTable["\\"] = [/\\/g, "_backslash_"];
RgxTable["/"] = [/\//g, "_slash_"];
RgxTable[":"] = [/\:/g, "_colon_"];
RgxTable["^"] = [/\^/g, "_carrot_"];
RgxTable["$"] = [/\$/g, "_dollar_"];
RgxTable["."] = [/\./g, "_dot_"];
RgxTable["*"] = [/\*/g, "_asterisk_"];
RgxTable["("] = [/\(/g, "_leftperen_"];
RgxTable[")"] = [/\)/g, "_rightperen_"];
RgxTable["["] = [/\[/g, "_leftbracket_"];
RgxTable["]"] = [/\]/g, "_rightbracket_"];
RgxTable["?"] = [/\?/g, "_questionmark_"];
RgxTable["+"] = [/\+/g, "_addition_"];

module.exports = {
    makeExpressPath,
    makeGQLCompatible,
    parseGQLPaths,
    parseDescriptors,
    isES6Func
}




/**
 * @returns {Boolean} bool
 * @description checks if a function is of es6 
 * arrow syntax via its toString property
 * @param {Function} f a function 
 */
function isES6Func(f) {
    return typeof f === "function" && /^[^{]+?=>/.test(f.toString());
}




/**
 * @returns {{dName:String, dValue:String, dArgs:Array<String>} | void} 
 * an array of descriptors or void if there are no `@` descriptors to parse
 * @description extracts all lines with matching `@` symbols 
 * and parses them into descriptor objects
 * @param {String} query the query used in Xprsso.set
 */
function parseDescriptors(query) {
    var desc = query.match(/@.*/g);

    if (desc !== null) {
        var result = [];
        for (let d of desc) {
            //@all is a special case it needs to be converted to a gql compatible string first
            //in order to picked up by the match function
            let returnExpressPath = false;
            if (d.includes("@all")) {
                for (let token of RgxTable) {
                    d = d.replace(...RgxTable[token]);
                }
                d = d.replace(RgxTable[":"][1], ":");
                returnExpressPath = true;
            }


            const DESCRIPTOR = {
                dName: match(d, /^@(\w+)/)[1] || throws("DNAME"),
                dValue: match(d, /(\w+)(\:|\;)/, returnExpressPath)[1] || throws("DVALUE"),
                dArgs: match(d, /(\:|\;)(.*)/)[2]
                    .split(" ")
                    .map(v => v.trim())
                    .filter(v => v.length !== 0 && v !== "->")

            };
            result.push(DESCRIPTOR);
        }
        return result;
    }
    return void 0;

    function throws(reason) {
        switch (reason) {
            case "DNAME":
                throw SyntaxError("descriptor @name is missing");
            case "DVALUE":
                throw SyntaxError("descriptor value: is missing did you forget a semicolon?");
        }
    }

    function match(str, rgx, returnExpressPath) {
        var m = str.match(rgx);
        if (m === null) {
            return [];
        }
        if (returnExpressPath) {
            return [, makeExpressPath(m[1])];
        }
        return m;
    }
}


/**
 * @returns {String} a modified query string
 * @param {String} query the query used in Xprsso.set
 * @description converts all GQL unfriendly characters 
 * into a parsable query
 */
function makeGQLCompatible(query) {
    validateQuery(query);
    query = removeComments(query);
    query = removeDescriptors(query);


    for (let token of RgxTable) {
        query = query.replace(...RgxTable[token]);
    }
    return query;
}



/**
 * @returns {String} string
 * @description converts GQL compatible  paths
 * into express compatible paths eg. _slash_api  to  /api
 * @param {String} path a single line path that 
 * contains GQL compatible express paths
 */
function makeExpressPath(path) {
    validateQuery(path);
    if (isExpressRegX(path)) {
        //Replace begining and ending _slash_ with "" because new RegExp will add a / 
        path = path.replace(/^_slash_/, "");
        path = path.replace(/_slash_$/, "");
        for (let token of RgxTable) {

            path = path.replace(new RegExp(RgxTable[token][1], "g"), token);
        }
        // this it to make sure the express is gettin a RegExp object to use as its path
        path = new RegExp(path)
    } else {
        for (let token of RgxTable) {
            path = path.replace(new RegExp(RgxTable[token][1], "g"), token);
        }
    }

    return path;
}


/**
 * @throws Error if there are no paths to extract
 * @returns {Array<String>} an Array of GQL compatible paths
 * @description extracts GQL compatible paths from the query
 * @param {String} query query used in Xprsso.set
 */
function parseGQLPaths(query) {
    validateQuery(query)
    var paths = query.match(/(_[a-zA-Z])\w+/g);

    if (paths === null) {
        throw Error("No express paths were specified check your query");
    }
    return paths;

}

/**
 * @description removes all lines that include `#`
 * @param {String} query query used in Xprsso.set
 */
function removeComments(query) {
    return query.replace(/.*#.*/gm, "");
}


/**
 * @description removes all lines that include `@`
 * @param {String} query query used in Xprsso.set
 */
function removeDescriptors(query) {
    return query.replace(/@.*/g, "");
}


/**
 * @returns {void} void
 * @description runs validators on the query
 * @param {String} query query used in Xprsso.set
 */
function validateQuery(query) {
    if (typeof query !== "string") {
        throw TypeError("Query should be a typeof string");
    }
    if (query.trim().length === 0) {
        throw Error("Query is empty");
    }
    return void 0;
}

/**
 * @returns {boolean} boolean
 * @description tests to see if path begins and ends 
 * with a slash
 * @param {String} path a GQL compatible path
 */
function isExpressRegX(path) {
    return path.match(/^_slash_.*_slash_$/) != null;
}
