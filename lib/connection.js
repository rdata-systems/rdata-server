/**
 * Connection class
 */

const events = require('events');
const EventEmitter = events.EventEmitter;
const util = require('util');
const JsonRpc = require('./json-rpc');
const RDataUser = require('./user').RDataUser;

function RDataConnection(websocket){

    var self = this;

    // RDataConnection as EventEmitter
    EventEmitter.call(this);

    // Connection information
    self.websocket = websocket;
    self.user = null;
    self.authorized = false;
    self.gameVersion = null;

    self.send = function(response){
        return self.websocket.send(JSON.stringify(response));
    };

    self.authorize = function(userId, gameVersion, callback){
        self.authorized = true;
        self.user = new RDataUser(userId, this);
        self.gameVersion = gameVersion;
        callback();
    };

    self.websocket.on('message', function(data){
        var message;
        try {
            message = JSON.parse(data);
        } catch (err) {
            var response = new JsonRpc.JsonRpcResponse({error: new JsonRpc.JsonRpcErrors.ParseError()});
            self.websocket.send(JSON.stringify(response));
        }
        if(message)
            self.emit('message', message);
    });

    self.websocket.on('close', function close() {
        self.emit('close');
    });

    self.on('message', function(message){
        if(!Array.isArray(message)) { // Single request
            var request;
            try {
                request = new JsonRpc.JsonRpcRequest(message);
            } catch (err) {
                self.send(new JsonRpc.JsonRpcResponse({error: new JsonRpc.JsonRpcErrors.InvalidRequest()}));
            }
            if (request)
                self.emit('request', request);

        } else if(message.length > 0) { // Multiple requests (batch request)
            var requests = [];
            while(message.length > 0){
                try {
                    request = new JsonRpc.JsonRpcRequest(message.shift());
                } catch (err) {
                    request = null; // Invalid request. Just add null to the requests, let batch request processor do the rest
                }
                requests.push(request);
            }
            self.emit('batch request', requests);
        } else {
            // Empty array. According to the Json-Rpc 2.0 standard, we should ignore that
        }
    });
}


util.inherits(RDataConnection, EventEmitter);

module.exports = {
    RDataConnection: RDataConnection
};