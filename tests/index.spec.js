var { 
    makeExpressPath,
    makeGQLCompatible,
    parseGQLPaths,
    parseDescriptors,
    isES6Func 
} = require("../lib/regex.js");
var { assert } = require("chai");
var Xprsso = require("../");
var express = require("express");


describe("regex", function regexSuite(){

    it("isES6Func returns true when passed a es6 arrow function", () => {
        assert.isTrue(isES6Func(() => {}))
    });

    it("isES6Func returns false when passed a regular function", () => {
        assert.isFalse(isES6Func(function(){}))
    });


    {  const query = `
    {
        / {
            @param id: foo -> bar -> baz
            GET {
                baz
            }
        }
        /api {
            POST {
                bar
            }
        }
    }
    `
        it("parseSecriptors returns correct dValue", () => {
        
            assert.equal(parseDescriptors(query)[0].dValue, "id")
        });

        it("parseSecriptors returns correct dArgs", () => {
            
            var [foo, bar, baz] = parseDescriptors(query)[0].dArgs;

            assert.isTrue
            ((foo === "foo" && bar === "bar" && baz === "baz"));
        });

        it("parseSecriptors returns correct dName", () => {
        
            assert.equal(parseDescriptors(query)[0].dName, "param")
        });

        it("makeExpressPath returns a valid express path", () => {
            assert.equal(makeExpressPath("_slash_api"), "/api");
            assert.equal(makeExpressPath("_slash_api_slash_"), "/api/");
        })
    
        it("makeGQLCompatible returns a valid GQL String", () => {
            assert.equal(makeGQLCompatible("/api"), "_slash_api");
            assert.equal(makeGQLCompatible("/api/"), "_slash_api_slash_");
        })
    
        it("parseGQLPaths parses GQL strings", () => {
            var [a,b] = parseGQLPaths(makeGQLCompatible(query));
            assert.equal(a, "_slash_");
            assert.equal(b, "_slash_api");
        })
    }
})


describe("xprsso", function xprssoSuite(){
    var x = new Xprsso;
    it("xprsso.addOptions adds options", () => {
        x.addOptions("foo", {bar:"baz"});
        assert.property(x.options, "foo");
    })

    it("xprsso.addTask adds task", () => {
        x.addTask(function foo(){});
        assert.property(x.tasks, "foo");
    })
    it("xprsso.addDescriptor adds a descriptor", ()=>{
        x.addDescriptor({name:"bar", hook:function(){}});
        assert.property(x.descriptors, "bar");

    })
    it("xprsso.set sets query on express app", done => {
        x.set(express(), 
            `{
                / {
                    GET {
                        foo
                    }
                }
            }`
        ).once("ready", () => {
            assert.isTrue(true);
            done();
        })
    })
    
})