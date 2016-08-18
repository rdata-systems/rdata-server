const RDataServer = require('../lib/rdata-server');
const WebSocket = require('ws');
const assert = require('assert');

const jsonRpcVersion = "2.0";
const port = 8889;


const testCommand = function(client, params, callback){
    callback(params);
};

describe('RDataServer', function() {
    it('returns a callback when server is started', function(done){
        var server = new RDataServer({ port: port });
        server.runServer(function(){
            server.close(function(){
                done();
            });
        });
    });

    it('accepts a single connection', function (done) {
        var server = new RDataServer({ port: port });
        server.runServer(function(){
            var ws = new WebSocket('ws://localhost:'+port);
        });
        server.on('client connected', function(client){
            server.close(function() {
                done();
            });
        });
    });

    it('should not accept non-anonymous command without authentication', function(done){
        var server = new RDataServer({ port: port, commands: { test: testCommand } });
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "test",
            "params": {"testParam": 123}
        });
        server.runServer(function(){
            var ws = new WebSocket('ws://localhost:'+port);
            ws.on('open', function open(){
                ws.send(testRequest);
            });
            ws.on('message', function message(data, flags){
                var answer = JSON.parse(data);
                assert(answer.error);
                assert(answer.error.code == -31000); // NonAuthenticated
                server.close(function () {
                    done();
                })
            });
        });
    });

    it('should accept anonymous command without authentication', function(done){
        var server = new RDataServer({ port: port, anonymousCommands: {"test": testCommand } });
        var testParams = {"testParam": 123};
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "test",
            "params": testParams
        });
        server.runServer(function(){
            var ws = new WebSocket('ws://localhost:'+port);
            ws.on('open', function open(){
                ws.send(testRequest);
            });
            ws.on('message', function message(data, flags){
                var answer = JSON.parse(data);
                assert.deepEqual(answer.result, testParams);
                server.close(function () {
                    done();
                })
            });
        });
    });

    it('accepts a default authentication request', function(done){
        var server = new RDataServer({ port: port });
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "authenticate",
            "params": {"userId": "testUser"}
        });
        server.runServer(function(){
            var ws = new WebSocket('ws://localhost:'+port);
            ws.on('open', function open(){
                ws.send(testRequest);
            });
            ws.on('message', function message(data, flags){
                var answer = JSON.parse(data);
                assert(answer.result == true);
                server.close(function () {
                    done();
                })
            });
        });
    });

    it('accepts a custom authentication request', function(done){
        var customAuthCommand = function(client, params, callback){
            client.userId = params.userId;
            client.authToken = params.authToken;
            callback(client.authToken);
        };
        var token = "token123";
        var server = new RDataServer({ port: port, anonymousCommands: { "authenticate": customAuthCommand } });
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "authenticate",
            "params": {"userId": "testUser", "authToken": token }
        });
        server.runServer(function(){
            var ws = new WebSocket('ws://localhost:'+port);
            ws.on('open', function open(){
                ws.send(testRequest);
            });
            ws.on('message', function message(data, flags){
                var answer = JSON.parse(data);
                assert(answer.result == token);
                done();
            });
        });
    });
});