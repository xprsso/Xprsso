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

```javascript
// Make sure to pass in your express application.
x.set(app, Xprsso.fromFile(pathToFile))
```
Xpresso emits ```"ready"``` when its finished.

```javascript
x.once("ready", function onRdy(){
    app.listen(8000);
})
```

## Using @descriptors

```@descriptors``` provide extra functionality.


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
