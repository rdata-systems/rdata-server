/**
 * Client class
 */

const events = require('events');
const EventEmitter = events.EventEmitter;
const util = require('util');
const JsonParser = require('jsonparse');
const JsonRpc = require('./json-rpc');

function RDataClient(connection){

    var self = this;

    // Server as EventEmitter
    EventEmitter.call(this);

    // Client information
    self.authenticated = false;

    self.send = function(response){
        return self.connection.send(response.getJson());
    };

    self.initConnection = function(connection){
        self.connection = connection;
        self.connection.on('message', function(data){
            try {
                self.parser.write(data);
            } catch (err) {
                var response = new JsonRpc.JsonRpcResponse({error: new JsonRpc.JsonRpcErrors.ParseError()});
                self.connection.send(response.getJson());
                self.initJsonParser(); // Reset json parser. TODO: Find better way to reset it
            }
        });

        self.connection.on('close', function close() {
            self.emit('disconnected');
        });
    };

    self.initJsonParser = function(){
        self.parser = new JsonParser();
        self.parser.onValue = function onJsonMessage(message) {
            if (this.stack.length) { // wtf? Replace
                return;
            }

            self.emit('message', message);
        };
    };

    self.on('message', function(message){
        var request;
        try {
            request = new JsonRpc.JsonRpcRequest(message);
        } catch(err) {
            self.send(new JsonRpc.JsonRpcResponse({error: new JsonRpc.JsonRpcErrors.InvalidRequest()}));
            return;
        }
        self.emit('request', request);
    });

    // Init WebSocket connection
    self.initConnection(connection);

    // Init streaming json parser
    self.initJsonParser();
}

var commands = {
    authenticate: function(client, params, callback){
        client.userId = params.userId;
        callback(true);
    }
};


util.inherits(RDataClient, EventEmitter);

module.exports = {
    'RDataClient': RDataClient,
    'commands': commands
};