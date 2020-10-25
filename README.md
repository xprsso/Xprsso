# Xprsso
A new way to write express applications



## Installation

```bash
npm install xprsso
```

## Documentation

Xprsso is built with GraphQL and Express.
It aims to improve productivity and bring
rapid prototyping to your Express middleware.

```javascript
var express = require("express");
var Xprsso = require("xprsso");

var app = express()
var x = new Xprsso;
```

In Xprsso, you can think of middlware as ```tasks```

```javascript
//Tasks cannot be anonymous. They must be named function expressions.

x.addTask(function sendOK(request, response){
    response.status(200).send("OK");
})
```
By default all tasks share a ```this``` value.
via ```x.sharedThis```
Now that you have added a task you can set that to a path.
```GraphQL
{

    # This is a comment. Only single line comments are supported.
    # / has subfields of HTTP methods like GET PUT POST... and so on.
    # Any task you create is exposed to the HTTP methods subfields. 

    / {
        GET {
            sendOK
        }
    }

    # You can use regex as well. It must end in a /

    /ab(cd)?e/ {

        # This route path will match /abe and /abcde.
        
        POST {
            sendOK
        }
    }

}
```

xprsso tries to resolve the second argument as a file path for a query but if it does not exist it uses the argument itself as query.
```javascript
// Make sure to pass in your express application.
x.set(app, "path to query or query")
```
xprsso emits ```"ready"``` when its finished.

```javascript
x.once("ready", function onRdy(){
    app.listen(8000);
})
```

## Using @descriptors

```@descriptors``` provide extra functionality.


### built in middleware
xprsso has ```@descriptor``` hooks provided already for Express's built in middleware

The syntax
```
@foo; 
```

or if you added options with ```xprsso.addOptions```

```
@bar barOptions;
```

### @json, @raw, @text, @urlencoded

* ```@json``` is the use of Express's ```express.json```
* ```@raw``` is the use of Express's ```express.raw```
* ```@text``` is the use of Express's ```express.text```
* ```@urlencoded``` is the use of Express's ```express.urlencoded```

```GraphQL
 {
    @json;

     / {
      GET {
            foo
        }
     }
 }
```
You can optionally add options with ```addOptions```
```javascript
x.addOptions("jsonOpts", {...youropts});
```
then apply it like so
```GraphQL
 {
    @json jsonOpts;
     / {
      GET {
            foo
        }
     }
 }
```
The same applies to the descriptors listed above.

### @static
```@static``` is the use of Express's ```express.static```
```GraphQL
 {
    @static dir: /public  -> ../build/public
     / {
      GET {
            sendIndex  
        }
     }
 }
```
optionaly set options for express static

```javascript
   x.addOptions("dir", {fallthrough:false});
```


while ```dir``` can optionally be a reference to express static options
it does not have to be called ```dir``` consider

```GraphQL
 {
    @static foo: /bar -> ../build/bar
     / {
      GET {
            sendIndex  
        }
     }
 }
```
and
```javascript
   x.addOptions("foo", {...fooOptions});
```



### @param

```@param``` is the use of Express's ```router.param(id)``` where ```id``` is the text after 
```@param``` ending in a colon ```:```


```GraphQL
 {
     /api/:user_id {
         
         # doFoo will execute  when the endpoint /api/:user_id is hit.
         # it will then move on to the router level middlware depending 
         # on the HTTP metthod used

         @param user_id: doFoo

         POST {
             sendOK
         }
     }
 }
```
You  can specify multiple param middlware to be used, with the ```->``` syntax.
Make sure they call next or it will hang your application.

```GraphQL
{
    /api/:user_id {

        @param user_id: doFoo -> doBar -> doBaz

        GET {
            bar
            sendOK
        }
        PUT {
            foo
            sendOK
        }
    }
}
```
### @all
```@all``` is the use of Express's ```app.all(value, ...[args])``` where ```value``` is the text after 
```@all``` ending in a colon ```:``` and args will be the text after the colon ```:``` any number of tasks can be used

```GraphQL
{
    @all /api/*: authenticate -> doFoo -> doBar
    
    /api {
        GET {
            sendOK
        }
      
    }
}
```

## Adding your own descriptor hooks
You can add a descriptor hook(s) to use within the query.
Hooks should be regular functions xprsso throws when it detects
that a es6 arrow function was used.
The hook function takes three arguments.

 * ```app```  your express application.
 * ```value``` a value that will be passed into the query
 * ```args``` a argument(s) that will be passed into the query
 
```javascript
x.addDescriptor({name:"sayHello", hook(app, value, args){

    console.log("hello ", value,  ...args);
    //you can do something with app here.
    //you can do something with "this" here.
}})
```
then 

```GraphQL
{
    @sayHello val1: arg1 -> arg2 -> arg3
       / {
        GET {
            sendOK
        }
       }
}
```
Expected output when xprsso emits "ready"
```
hello val1 arg1 arg2 arg3
```

