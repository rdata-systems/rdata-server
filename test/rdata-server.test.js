const RDataServer = require('../lib/rdata-server');
const errors = require('../lib/errors');
const JsonRpc = require('../lib/json-rpc');
const helper = require('./helper');
const WebSocket = require('ws');
const assert = require('assert');
const mocha = require('mocha');
const beforeEach = mocha.beforeEach;
const afterEach = mocha.afterEach;

const jsonRpcVersion = helper.jsonRpcVersion;
const port = helper.port;
const dbUrl = helper.dbUrl;


const testCommand = function(db, client, params, callback){
    callback(params);
};

var customAuthCommand = function(db, client, params, callback){
    client.userId = params.userId;
    client.authToken = params.authToken;
    callback(client.authToken);
};

describe('RDataServer', function() {

    beforeEach(function(done) {
        helper.cleanTestDatabase(done);
    });

    afterEach(function(done){
        helper.cleanTestDatabase(done);
    });

    it('returns a callback when server is started', function(done){
        var server = new RDataServer({ port: port, dbUrl: dbUrl });
        server.runServer(function(){
            server.close(function(){
                done();
            });
        });
    });

    it('accepts a single connection', function (done) {
        var server = new RDataServer({ port: port, dbUrl: dbUrl });
        server.runServer(function(){
            var ws = new WebSocket('ws://localhost:'+port);
        });
        server.on('client connected', function(client){
            server.close(function() {
                done();
            });
        });
    });

    it('should not accept request without id', function(done){
        var server = new RDataServer({ port: port, dbUrl: dbUrl, anonymousCommands: { test: testCommand } });
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
                assert(answer.id == null);
                assert(answer.error);
                assert(answer.error.code == (new errors.JsonRpcErrors.NotificationsNotSupported()).code);
                server.close(function () {
                    done();
                })
            });
        });
    });

    it('should not accept request without valid method', function(done){
        var server = new RDataServer({ port: port, dbUrl: dbUrl, commands: { test: testCommand } });
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "invalidMethod",
            "params": {"testParam": 123},
            "id": 1
        });
        server.runServer(function(){
            helper.connectAndAuthenticate(function authenticated(ws) {
                ws.send(testRequest);
                ws.on('message', function message(data, flags){
                    var answer = JSON.parse(data);
                    assert(answer.id == 1);
                    assert(answer.error);
                    assert(answer.error.code == (new JsonRpc.JsonRpcErrors.MethodNotFound()).code);
                    server.close(function () {
                        done();
                    })
                });
            });
        });
    });

    it('should not accept non-anonymous command without authentication', function(done){
        var server = new RDataServer({ port: port, dbUrl: dbUrl, commands: { test: testCommand } });
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "test",
            "params": {"testParam": 123},
            "id": 1
        });
        server.runServer(function(){
            var ws = new WebSocket('ws://localhost:'+port);
            ws.on('open', function open(){
                ws.send(testRequest);
            });
            ws.on('message', function message(data, flags){
                var answer = JSON.parse(data);
                assert.equal(answer.id, 1);
                assert(answer.error);
                assert(answer.error.code == -31000); // NonAuthenticated
                server.close(function () {
                    done();
                })
            });
        });
    });

    it('should accept anonymous command without authentication', function(done){
        var server = new RDataServer({ port: port, dbUrl: dbUrl, anonymousCommands: {"test": testCommand } });
        var testParams = {"testParam": 123};
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "test",
            "params": testParams,
            "id": 1
        });
        server.runServer(function(){
            var ws = new WebSocket('ws://localhost:'+port);
            ws.on('open', function open(){
                ws.send(testRequest);
            });
            ws.on('message', function message(data, flags){
                var answer = JSON.parse(data);
                assert.equal(answer.id, 1);
                assert.deepEqual(answer.result, testParams);
                server.close(function () {
                    done();
                })
            });
        });
    });

    it('accepts a default authentication request', function(done){
        var server = new RDataServer({ port: port, dbUrl: dbUrl });
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "authenticate",
            "params": {"userId": "testUser"},
            "id": 1
        });
        server.runServer(function(){
            var ws = new WebSocket('ws://localhost:'+port);
            ws.on('open', function open(){
                ws.send(testRequest);
            });
            ws.on('message', function message(data, flags){
                var answer = JSON.parse(data);
                assert.equal(answer.id, 1);
                assert(answer.result == true);
                server.close(function () {
                    done();
                })
            });
        });
    });

    it('accepts a custom authentication request', function(done){
        var token = "token123";
        var server = new RDataServer({ port: port, dbUrl: dbUrl, anonymousCommands: { "authenticate": customAuthCommand } });
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "authenticate",
            "params": {"userId": "testUser", "authToken": token },
            "id": 1
        });
        server.runServer(function(){
            var ws = new WebSocket('ws://localhost:'+port);
            ws.on('open', function open(){
                ws.send(testRequest);
            });
            ws.on('message', function message(data, flags){
                var answer = JSON.parse(data);
                assert.equal(answer.id, 1);
                assert(answer.result == token);
                server.close(function () {
                    done();
                })
            });
        });
    });

    it('should accept non-anonymous command after authentication', function(done){
        var server = new RDataServer({ port: port, dbUrl: dbUrl, commands: { test: testCommand } });
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "test",
            "params": {"testParam": 123},
            "id": 2
        });
        server.runServer(function(){
            helper.connectAndAuthenticate(function authenticated(ws) {
                ws.send(testRequest);
                ws.on('message', function message(data, flags){
                    var answer = JSON.parse(data);
                    assert.equal(answer.result.testParam, 123);
                    server.close(function () {
                        done();
                    })
                });
            });
        });
    });


});