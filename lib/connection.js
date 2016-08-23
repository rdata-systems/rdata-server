/**
 * Connection class
 */

const events = require('events');
const EventEmitter = events.EventEmitter;
const util = require('util');
const JsonRpc = require('./json-rpc');

function RDataConnection(websocket){

    var self = this;

    // RDataConnection as EventEmitter
    EventEmitter.call(this);

    // Connection information
    self.websocket = websocket;
    self.userId = null;
    self.authenticated = false;

    self.send = function(response){
        return self.websocket.send(response.getJson());
    };

    self.websocket.on('message', function(data){
        var message;
        try {
            message = JSON.parse(data);
        } catch (err) {
            var response = new JsonRpc.JsonRpcResponse({error: new JsonRpc.JsonRpcErrors.ParseError()});
            self.websocket.send(response.getJson());
        }
        if(message)
            self.emit('message', message);
    });

    self.websocket.on('close', function close() {
        self.emit('disconnected');
    });

    self.on('message', function(message){
        var request;
        try {
            request = new JsonRpc.JsonRpcRequest(message);
        } catch(err) {
            self.send(new JsonRpc.JsonRpcResponse({error: new JsonRpc.JsonRpcErrors.InvalidRequest()}));
        }
        if(request)
            self.emit('request', request);
    });
}


util.inherits(RDataConnection, EventEmitter);

module.exports = {
    RDataConnection: RDataConnection
};