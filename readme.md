# RData - Data Collection Instrument

Based on WebSockets, Json-RPC 2.0 and MongoDB

## Basic usage
~~~~ 
var RDataServer = require('rdata-server');

var server = new RDataServer({
    host: '0.0.0.0',
    port: 8888,
    dbUrl: 'mongodb://localhost:27017/data',
});
server.runServer();
~~~~ 
RDataServer options:
- **host** - Server host
- **Port** - Server port
- **dbUrl** - Connection url of the MongoDB
- **exposed** - dictionary with exposed methods. Contains methodName and method. See: exposing new methods
- **exposedAnonymously** - dictionary with anonymously exposed methods. See: exposing new methods
- **controllers** - dictionary with custom controllers. See: exposing custom controllers

The package includes standard server.js bootstrap script that you can use.

## Json-RPC
RData protocol is built on top of [JSon-RPC 2.0](http://www.jsonrpc.org/specification). This is a basic example of sending data to the server:
~~~~ 
{
    "jsonrpc": "2.0",
    "method": "authenticate",
    "params": {"userId": "USERTOKEN"},
    "id": 1
}
~~~~ 
Where:
- "jsonrpc" - Json RPC version, must always be "2.0"
- "method" - RPC method to call
- "params" - params, must be array or object
- "id" - request id, must be unique per connection.

Server will answer with the result object:
~~~~ 
{
    "jsonrpc": "2.0",
    "result": true,
    "id": 1
}
~~~~ 

## Authentication
RData-Server doesn't handle any specific way of authentication. It's up to you to implement your own authentication module. By default, simple **"authenticate"** method is provided that accepts single parameter **userId**. You need to call this method before you can start sending other requests. **userId** will be assigned to the connection. You can provide your own authentication method, see **exposing custom methods** and **custom controllers**.

## Events
Events are the simplest way of logging non-persistent data into the system. Main method to log event is **"logEvent"**.

**logEvent** - Logs specific event.
~~~~ 
{
    "jsonrpc": "2.0",
    "method": "logEvent",
    "params": {
        "name": "MissionFailedEvent",
        "time": 1474562400326
        "data": {
            "missionName": "FollowTheWhiteRabbit"
        }
    }
}
~~~~ 
Parameters:
- **name** - contains name, for example, MissionFailedEvent
- **time** - optional parameter, unix timestamp in milliseconds (UTC). If not provided, server time from Date.now() will be used.
- **data** - might contain any random data associated with event, for example missionName.

## Contexts
Contexts are the core of the RData API. Contexts are made to log continuous data, that has start time and end time.
Generally, there is no way to track when your application is closed, especially on mobile platforms. That makes logging the accurate time data insanely hard. This is one of the issues that RData Server is meant to solve. Since it is connection-based, RData-Server will **automatically close** all **non-persistent** **contexts**. That means that if your player started the contexst by calling StartContext, and then application crashed or user closed it, once user is disconnected/timed-out, the context will be closed automatically. 

Context can be marked as **persistent**. That means that this context will not be closed automatically when app crashes. This is useful if you have continuous context that can live even when app is closed. For example, if mission can be started continued after the app is closed, and finished weeks later, you can use persistent context to log this data.

Context can have **parentContextId**. If parent context id is presented, this context will be marked as "child context" to another context. When the parent context is closed, all it's child contexts will be automatically closed.

When working with contexts, built-in events will be logged, such as StartContextEvent, EndContextEvent, RestoreContextEvent and EndUserContextsEvent (logged when user is disconnected). The data of these events matches the data from methods called. 

Methods to work with contexts:

**startContext** - Starts specific context.
~~~~
{
    "jsonrpc": "2.0",
    "method": "startContext",
    "params": {
        "id": "CONTEXTGUID", 
        "name": "StartMissionContext", 
        "timeStarted": 1474562400326,
        "persistent": false,
        "parentContextId": "PARENTCONTEXTGUID",
        "data": {
            "missionName": "SaveTheZion"
        }
    },
    "id": 1
}
~~~~
Parameters:
- **id** - Id of the context. This should be unique id for the context, ideally GUID. You must keep track of it to be able to close the context later. Even if 2 identical contexts are logged (with the same name and data), they must have unique id.
- **name** - Name of the context. For example, "StartMissionContext".
- **timeStarted** - optional parameter, unix timestamp in milliseconds (UTC). If not provided, server time from Date.now() will be used.
- **persistent** - optional parameter, boolean, false by default. If true, context will be marked as "persistent" and will not be automatically closed when user is disconnected
- **parentContextId** - optional parameter, id of the parent context. If specified, when parent context is closed this context will also be closed.
- **data** - Custom data of the context.


**endContext** - Ends context with given id. If context ID has child contexts, they will also be closed.
~~~~
{
    "jsonrpc": "2.0",
    "method": "endContext",
    "params": {
        "id": "CONTEXTGUID", 
        "timeEnded": 1474562400326
    },
    "id": 1
}
~~~~
Parameters:
- **id** - Id of the context to close. 
- **timeEnded** - optional parameter, unix timestamp in milliseconds (UTC). If not provided, server time from Date.now() will be used.


**restoreContext** - restores previously closed context. This is useful if you want to restore the state of your app after it was closed. The context status will be marked as "static" and timeEnded will be reset to null.
~~~~
{
    "jsonrpc": "2.0",
    "method": "restoreContext",
    "params": {
        "id": "CONTEXTGUID"
    },
    "id": 1
}
~~~~
Parameters:
- **id** - Id of the context to restore


## User Variables
RData server supports logging user variables. This is helpful when you want to log some number that is changed over the time. All updates will be logged using built-in events, such as InsertVariableEvent, UpdateVariableEvent and ReplaceVariableEvent. Data sent with these events matches the data sent when the same methods are called.

**insertVariable** - Inserts a specific variable associated with user authenticated.
~~~~
{
    "jsonrpc": "2.0",
    "method": "insertVariable",
    "params": {
        "key": "playerHp", 
        "value": 100
    },
    "id": 1
}
~~~~
Parameters:
- **key** - variable name
- **value** - variable value. Can contain primitive or array/object

**replaceVariable** - Replaces user variable. MongoDB method replaceOne will be used. This is helpful when you have a structural data that you want to fully overwrite. Must contain either "key" or "filter".
~~~~
{
    "jsonrpc": "2.0",
    "method": "insertVariable",
    "params": {
        "key": "playerHp", 
        "value": 100,
        "filter": { "value": {"var": 1234} },
        "options": {
            "upsert": false
        }
    },
    "id": 1
}
~~~~
Parameters:
- **key** - variable name
- **value** - optional parameter, new variable value. Can contain primitive or array/object. If not provided, filter will be user.
- **filter** - optional parameter, filter that is used to replace variable using replaceOne. If not provided, key will be used.
- **options** - options that are passed to replaceOne. Currently one option is supported - "upsert". This will insert variable when it is not found.

**update** - Updates user variable. MongoDB method updateOne will be used. Must contain either "key" or "filter".
~~~~
{
    "jsonrpc": "2.0",
    "method": "insertVariable",
    "params": {
        "key": "playerHp", 
        "value": 100,
        "filter": { "value": {"var": 1234} },
        "update": { "value": {"var": 3456} },
        "options": {
            "upsert": false
        }
    },
    "id": 1
}
~~~~
Parameters:
- **key** - variable name
- **value** - new variable value. Can contain primitive or array/object. 
- **filter** - optional parameter, filter that is used to replace variable using replaceOne.
- **update** - update query, will be passed to updateOne. 
- **options** - options that are passed to updateOne. Currently one option is supported - "upsert". This will insert variable when it is not found.


## Extending the functionality
RData-Server is built to be extendable. To extend functionality of the server, you can provide new methods or controllers.

**Exposing new methods**
In the server options, you can provide **exposed** or **exposedAnonymously** methods. This will add or overwrite existing exposed methods. Exposed methods require user to be authenticated, while methods that are Exposed Anonymously do not require that.

For example, to provide your own authentication method, you need to anonymously expose an "authenticate" method:
~~~~
var customAuthenticationMethod = function(connection, params, callback){
    connection.userId = params.userId;
    connection.authToken = params.authToken;
    callback(null, connection.authToken);
};

var options = { 
    host: '0.0.0.0',
    port: 8888,
    dbUrl: 'mongodb://localhost:27017/data',
    exposedAnonymously: {
        'authenticate': customAuthenticationMethod 
    } 
};
var server = new RDataServer(options);
~~~~

This example accepts custom "authToken" in params and writes it into the connection object.

Exposing non-anonymous method is very similar:
~~~~
var myMethod = function(connection, params, callback){
    callback(null, "result");
};

var options = { 
    host: '0.0.0.0',
    port: 8888,
    dbUrl: 'mongodb://localhost:27017/data',
    exposed: {
        'myMethod': myMethod 
    } 
};
var server = new RDataServer(options);
~~~~

In both anonymous and non-anonymous custom exposed methods, you must call the "callback" and provide error object as null in first argument, and result object in the second argument (this will be sent to the client).

**Exposing custom controllers**
Exposing custom controllers is very similar to exposing custom methods. However, exposing controllers gives you more power. The most important thing about controllers is that all controllers are asynchronously initialized with the server object when server starts. This gives you ability to asynchronously initialize your controller using, for example, database connection object. For example, you can build your collections, ensure indexes etc.

Here is the example of custom authentication controller:
~~~~
function CustomAuthController(server){
    if (this instanceof CustomAuthController === false) {
        return new CustomAuthController(server);
    }
    var self = this;
    self.server = server;
    self.db = server.db;
    
    self.init = function(callback){
        self.db.collection("customAuthCollection").createIndex(
            {"userId": 1},
            null,
            function(err, result) {
                if(typeof callback === 'function')
                    err ? callback(err, null) : callback(null, result);
            }
        );
        return self;
    };
    
    self.customAuthentication = function(connection, params, callback){
        connection.userId = params.userId;
        connection.authToken = params.authToken;
        
        // Check the authtoken using self.db here
        
        callback(null, connection.authToken);
    };
    
    self.exposedAnonymously = {
        'authenticate': self.customAuthentication,
    };
}
~~~~







