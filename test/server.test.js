const RDataServer = require('../lib/server');
const errors = require('../lib/errors');
const JsonRpc = require('../lib/json-rpc');
const helper = require('./helper');
const WebSocket = require('ws');
const assert = require('assert');
const mocha = require('mocha');
const beforeEach = mocha.beforeEach;
const afterEach = mocha.afterEach;

const jsonRpcVersion = helper.jsonRpcVersion;
const dbUrl = helper.dbUrl;


const testMethod = function(client, params, callback){
    callback(null, params);
};

var customAuthenticationMethod = function(client, params, callback){
    client.userId = params.userId;
    client.authToken = params.authToken;
    callback(null, client.authToken);
};

function CustomAuthController(server){
    if (this instanceof CustomAuthController === false) {
        return new CustomAuthController(server);
    }
    var self = this;
    self.server = server;
    self.exposedAnonymously = {
        'authenticate': customAuthenticationMethod,
    };
}

function CustomController(server){
    if (this instanceof CustomController === false) {
        return new CustomController(server);
    }
    var self = this;
    self.server = server;
    self.exposed = {
        'test': testMethod,
    };
}

describe('RDataServer', function() {

    beforeEach(function(done) {
        helper.clearTestDatabase(done);
    });

    afterEach(function(done){
        helper.clearTestDatabase(done);
    });

    it('returns a callback when server is started', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl });
        server.runServer(function(error, result){
            assert(!error);
            assert(result);

            server.close(function(error, result){
                done(error);
            });
        });
    });

    it('accepts a single connection', function (done) {
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl });
        server.runServer(function(error, result){
            assert(!error);
            assert(result);
            var ws = new WebSocket('ws://localhost:'+helper.port);
        });
        server.on('user connected', function(client){
            server.close(function(error) {
                done(error);
            });
        });
    });

    it('should not accept request without id', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl, exposed: {'test': testMethod }});
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "test",
            "params": {"testParam": 123}
        });
        server.runServer(function(){
            var ws = new WebSocket('ws://localhost:'+helper.port);
            ws.on('open', function open(){
                ws.send(testRequest);
            });
            ws.on('message', function message(data, flags){
                var answer = JSON.parse(data);
                assert(answer.id == null);
                assert(answer.error);
                assert(answer.error.code == (new errors.JsonRpcErrors.NotificationsNotSupported()).code);
                server.close(function(error) {
                    done(error);
                });
            });
        });
    });

    it('should accept request with string id', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl, exposedAnonymously: {'test': testMethod }});
        var requstId = "UNIQUEREQUESTGUID123";
        var testParams = {"testParam": 123};
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "test",
            "id": requstId,
            "params": testParams
        });
        server.runServer(function(){
            var ws = new WebSocket('ws://localhost:'+helper.port);
            ws.on('open', function open(){
                ws.send(testRequest);
            });
            ws.on('message', function message(data, flags){
                var answer = JSON.parse(data);
                assert(answer.id == requstId);
                assert.deepEqual(answer.result, testParams);
                server.close(function(error) {
                    done(error);
                });
            });
        });
    });

    it('should not accept request without valid method', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl});
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "invalidMethod",
            "params": {"testParam": 123},
            "id": 1
        });
        server.runServer(function(){
            helper.connectAndAuthenticate(function authenticated(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(testRequest);
                ws.on('message', function message(data, flags){
                    var answer = JSON.parse(data);
                    assert(answer.id == 1);
                    assert(answer.error);
                    assert(answer.error.code == (new JsonRpc.JsonRpcErrors.MethodNotFound()).code);
                    server.close(function(error) {
                        done(error);
                    });
                });
            });
        });
    });

    it('should not accept non-anonymous command without authentication', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl, exposed: {'test': testMethod } });
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "test",
            "params": {"testParam": 123},
            "id": 1
        });
        server.runServer(function(){
            var ws = new WebSocket('ws://localhost:'+helper.port);
            ws.on('open', function open(){
                ws.send(testRequest);
            });
            ws.on('message', function message(data, flags){
                var answer = JSON.parse(data);
                assert.equal(answer.id, 1);
                assert(answer.error);
                assert(answer.error.code == -31000); // NonAuthenticated
                server.close(function(error) {
                    done(error);
                });
            });
        });
    });

    it('should accept anonymous command without authentication', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl, exposedAnonymously: {'test': testMethod } });
        var testParams = {"testParam": 123};
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "test",
            "params": testParams,
            "id": 1
        });
        server.runServer(function(){
            var ws = new WebSocket('ws://localhost:'+helper.port);
            ws.on('open', function open(){
                ws.send(testRequest);
            });
            ws.on('message', function message(data, flags){
                var answer = JSON.parse(data);
                assert.equal(answer.id, 1);
                assert.deepEqual(answer.result, testParams);
                server.close(function(error) {
                    done(error);
                });
            });
        });
    });

    it('accepts a default authentication request', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl });
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "authenticate",
            "params": {"userId": "testUser"},
            "id": 1
        });
        server.runServer(function(){
            var ws = new WebSocket('ws://localhost:'+helper.port);
            ws.on('open', function open(){
                ws.send(testRequest);
            });
            ws.on('message', function message(data, flags){
                var answer = JSON.parse(data);
                assert.equal(answer.id, 1);
                assert(answer.result == true);
                server.close(function(error) {
                    done(error);
                });
            });
        });
    });

    it('accepts a custom authentication request provided by options.exposedAnonymously', function(done){
        var token = "token123";
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl, exposedAnonymously: {'authenticate': customAuthenticationMethod } });
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "authenticate",
            "params": {"userId": "testUser", "authToken": token },
            "id": 1
        });
        server.runServer(function(){
            var ws = new WebSocket('ws://localhost:'+helper.port);
            ws.on('open', function open(){
                ws.send(testRequest);
            });
            ws.on('message', function message(data, flags){
                var answer = JSON.parse(data);
                assert.equal(answer.id, 1);
                assert(answer.result == token);
                server.close(function(error) {
                    done(error);
                });
            });
        });
    });

    it('accepts a custom authentication request provided by options.controllers', function(done){
        var token = "token123";
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl, controllers: {'custom': CustomAuthController } });
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "authenticate",
            "params": {"userId": "testUser", "authToken": token },
            "id": 1
        });
        server.runServer(function(){
            var ws = new WebSocket('ws://localhost:'+helper.port);
            ws.on('open', function open(){
                ws.send(testRequest);
            });
            ws.on('message', function message(data, flags){
                var answer = JSON.parse(data);
                assert.equal(answer.id, 1);
                assert(answer.result == token);
                server.close(function(error) {
                    done(error);
                });
            });
        });
    });

    it('should accept non-anonymous command after authentication', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl, exposed: {'test': testMethod } } );
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "test",
            "params": {"testParam": 123},
            "id": 2
        });
        server.runServer(function(){
            helper.connectAndAuthenticate(function authenticated(error, ws) {
                if(error) {
                    done(error);
                    return;
                }
                ws.send(testRequest);
                ws.on('message', function message(data, flags){
                    var answer = JSON.parse(data);
                    assert.equal(answer.result.testParam, 123);
                    server.close(function(error) {
                        done(error);
                    });
                });
            });
        });
    });

    it('should accept non-anonymous command after authentication using custom controller', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl, controllers: {'custom': CustomController } } );
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "test",
            "params": {"testParam": 123},
            "id": 2
        });
        server.runServer(function(){
            helper.connectAndAuthenticate(function authenticated(error, ws) {
                if(error) {
                    done(error);
                    return;
                }
                ws.send(testRequest);
                ws.on('message', function message(data, flags){
                    var answer = JSON.parse(data);
                    assert.equal(answer.result.testParam, 123);
                    server.close(function(error) {
                        done(error);
                    });
                });
            });
        });
    });

    it('should accept batch request in array and return multiple responses in array', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl, exposedAnonymously: {'test': testMethod } });
        var requests = [
            {
                "jsonrpc": jsonRpcVersion,
                "method": "test",
                "params": {"testParam": 123},
                "id": 0
            },
            {
                "jsonrpc": jsonRpcVersion,
                "method": "test",
                "params": {"testParam": 456},
                "id": 1
            }
        ];
        server.runServer(function(){
            var ws = new WebSocket('ws://localhost:'+helper.port);
            ws.on('open', function open(){
                ws.send(JSON.stringify(requests));
            });
            ws.on('message', function message(data, flags){
                var answer = JSON.parse(data);
                assert(Array.isArray(answer));
                assert.equal(answer.length, 2);

                // Responses order is not guaranteed, client must use id to identify them
                answer.forEach(function(response){
                    var id = response.id;
                    assert.deepEqual(requests[id].params, response.result);
                });
                server.close(function(error) {
                    done(error);
                });
            });
        });
    });

    it('should correctly accept batch request with invalid requests and process only valid ones', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl, exposedAnonymously: {'test': testMethod } });
        var requests = [
            {},
            {
                "jsonrpc": jsonRpcVersion,
                "method": "INVALID_METHOD_NAME",
                "params": {"testParam": 123},
                "id": 1
            },
            {
                "jsonrpc": jsonRpcVersion,
                "method": "test",
                "params": {"testParam": 456},
                "id": 2
            }
        ];
        server.runServer(function(){
            var ws = new WebSocket('ws://localhost:'+helper.port);
            ws.on('open', function open(){
                ws.send(JSON.stringify(requests));
            });
            ws.on('message', function message(data, flags){
                var answer = JSON.parse(data);
                assert(Array.isArray(answer));
                assert.equal(answer.length, 3);
                var validResponseFound=false, invalidResponseFound=false, invalidMethodResponseFound=false;

                // Responses order is not guaranteed, client must use id to identify them. So let's find all 3 responses
                answer.forEach(function(response){
                    if(response.id !== null && response.result && requests[response.id].params.testParam == response.result.testParam){
                        validResponseFound = true;
                    }
                    if(response.id === null && response.error.code == (new JsonRpc.JsonRpcErrors.InvalidRequest()).code){
                        invalidResponseFound = true;
                    }
                    if(response.id !== null && response.error != null && response.error.code == (new JsonRpc.JsonRpcErrors.MethodNotFound()).code){
                        invalidMethodResponseFound = true;
                    }
                });
                assert(validResponseFound);
                assert(invalidResponseFound);
                assert(invalidMethodResponseFound);
                server.close(function(error) {
                    done(error);
                });
            });
        });
    });


});