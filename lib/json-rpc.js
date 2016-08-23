/**
 *  Simple JSON-RPC 2.0 server library implementation
 */
const util = require('util');
const version = "2.0";

function JsonRpcRequest(message){
    var self = this;

    // Validate message
    if(!message.jsonrpc)
        throw new JsonRpcException("JsonRpcRequest must contain jsonrpc version");

    if(message.jsonrpc != version)
        throw new JsonRpcException("JsonRpcRequest version must be exactly '2.0'");

    if(!message.method)
        throw new JsonRpcException("JsonRpcRequest must contain method name");

    if(message.params && typeof message.params != "object")
        throw new JsonRpcException("JsonRpcRequest.params must be a structured value");

    if(message.id && message.id != null && typeof message.id != "string" && typeof message.id != "number")
        throw new JsonRpcException("JsonRpcRequest.id must be null, string or number if included");

    // Build the request object
    self.version = message.jsonrpc;
    self.method = message.method;

    if(message.params)
        self.params = message.params;

    if(message.id !== undefined) {
        self.id = message.id;
        self.isNotification = false;
    } else {
        self.isNotification = true;
    }
}

function JsonRpcResponse(options){
    var self = this;

    if(options.error && options.result)
        throw new JsonRpcException("JsonRpcResponse can't have both error and result");

    if(!options.error && !options.result && options.result !== null)
        throw new JsonRpcException("JsonRpcResponse must have result or error");

    if(options.error && (!options.error.code || !options.error.message))
        throw new JsonRpcException("JsonRpc error must have both code and message");

    if(options.id && options.id != null && typeof options.id != "string" && typeof options.id != "number")
        throw new JsonRpcException("JsonRpcResponse.id must be null, string or number if included");

    // Build the response object
    self.jsonrpc = version;
    self.id = options.id || null;

    if(options.error)
        self.error = options.error;

    if(options.result)
        self.result = options.result;

    self.getJson = function(){
        return JSON.stringify(self);
    }
}


var JsonRpcException = function(message, extra) {
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.message = message;
    this.extra = extra;
};
util.inherits(JsonRpcException, Error);



var JsonRpcErrors = {
    // JsonRpc standard errors
    ParseError: function(data){
        this.message = 'Parse error';
        this.code = -32700;
        if(data) this.data = data;
    },
    InvalidRequest: function(data){
        this.message = 'Invalid request';
        this.code = -32600;
        if(data) this.data = data;
    },
    MethodNotFound: function(data){
        this.message = 'Method not found';
        this.code = -32601;
        if(data) this.data = data;
    },
    InvalidParams: function(data){
        this.message = 'Invalid params';
        this.code = -32602;
        if(data) this.data = data;
    },
    InternalError: function(data){
        this.message = 'Internal error';
        this.code = -32603;
        if(data) this.data = data;
    },
    ServerError: function(data){
        this.message = 'Server error';
        this.code = -32000;
        if(data) this.data = data;
    },

    // From -32000 to -32099 -  implementation-defined server-errors

};

module.exports = {
    // JsonRpc protocol
    'JsonRpcRequest': JsonRpcRequest,
    'JsonRpcResponse': JsonRpcResponse,

    // Errors
    'JsonRpcException': JsonRpcException,
    'JsonRpcErrors': JsonRpcErrors
};

