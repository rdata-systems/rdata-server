const RDataServer = require('../lib/server');
const errors = require('../lib/errors');
const JsonRpc = require('../lib/json-rpc');
const helper = require('./helper');
const WebSocket = require('ws');
const assert = require('assert');
const mocha = require('mocha');
const beforeEach = mocha.beforeEach;
const afterEach = mocha.afterEach;

const gameVersion = helper.gameVersion;
const jsonRpcVersion = helper.jsonRpcVersion;
const dbUrl = helper.dbUrl;


const testMethod = function(client, params, callback){
    callback(null, params);
};

var customAuthorizationMethod = function(connection, params, callback){
    connection.authorize(params.userId, params.gameVersion, params.userPayload || null, function (err) {
        if (err) return callback(err);
        return callback(null, true);
    });
};

function CustomAuthController(server){
    if (this instanceof CustomAuthController === false) {
        return new CustomAuthController(server);
    }
    var self = this;
    self.server = server;
    self.exposedAnonymously = {
        'authorize': customAuthorizationMethod
    };
}

function CustomController(server){
    if (this instanceof CustomController === false) {
        return new CustomController(server);
    }
    var self = this;
    self.server = server;
    self.exposed = {
        'test': testMethod
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

    it('correctly removes connection when user is disconnected', function (done) {
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl });
        var ws;
        server.runServer(function(error, result){
            assert(!error);
            assert(result);
            ws = new WebSocket('ws://localhost:'+helper.port);
        });
        server.on('user connected', function(client){
            assert(server.connections.length === 1);
            ws.close();
        });
        server.on('user disconnected', function(){
            setTimeout(function(){ // Wait for other events to fire. Connection is not removed from the list until then
                assert(server.connections.length === 0);
                server.close(function(error) {
                    done(error);
                });
            }, 0);
        });
    });

    it('does not accept request without id', function(done){
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

    it('accepts request with string id', function(done){
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

    it('does not accept request without valid method', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl});
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "invalidMethod",
            "params": {"testParam": 123},
            "id": 1
        });
        server.runServer(function(){
            helper.connectAndAuthorize(gameVersion, function authorized(error, ws) {
                if (error) {
                    done(error);
                    return;
                }

                ws.send(testRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    assert(answer.id == 1);
                    assert(answer.error);
                    assert(answer.error.code == (new JsonRpc.JsonRpcErrors.MethodNotFound()).code);
                    server.close(function (error) {
                        done(error);
                    });
                });
            });
        });
    });

    it('does not accept non-anonymous command without authorization', function(done){
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
                assert(answer.error.code == -31000); // NonAuthorized
                server.close(function(error) {
                    done(error);
                });
            });
        });
    });

    it('does accept anonymous command without authorization', function(done){
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

    it('accepts a default authorization request', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl });
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "authorize",
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
                assert(answer.result);
                assert(server.connections[0].authorized);
                server.close(function(error) {
                    done(error);
                });
            });
        });
    });

    it('accepts a custom authorization request provided by options.exposedAnonymously', function(done){
        var token = "token123";
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl, exposedAnonymously: {'authorize': customAuthorizationMethod } });
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "authorize",
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
                assert(answer.result);
                assert(server.connections[0].authorized);
                server.close(function(error) {
                    done(error);
                });
            });
        });
    });

    it('accepts a custom authorization request provided by options.controllers', function(done){
        var token = "token123";
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl, controllers: {'custom': CustomAuthController } });
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "authorize",
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
                assert(answer.result);
                assert(server.connections[0].authorized);
                server.close(function(error) {
                    done(error);
                });
            });
        });
    });

    it('accepts a custom authorization request provided by addController', function(done){
        var token = "token123";
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl})
        server.addController(CustomAuthController, 'customController');
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "authorize",
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
                assert(answer.result);
                assert(server.connections[0].authorized);
                assert(server.connections[0].user.userId === "testUser");
                server.close(function(error) {
                    done(error);
                });
            });
        });
    });

    it('accepts non-anonymous command after authorization', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl, exposed: {'test': testMethod } } );
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "test",
            "params": {"testParam": 123},
            "id": 2
        });
        server.runServer(function(){
            helper.connectAndAuthorize(gameVersion, function authorized(error, ws) {
                if (error) {
                    done(error);
                    return;
                }
                ws.send(testRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    assert.equal(answer.result.testParam, 123);
                    server.close(function (error) {
                        done(error);
                    });
                });
            });
        });
    });

    it('accepts non-anonymous command after authorization using custom controller', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl, controllers: {'custom': CustomController } } );
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "test",
            "params": {"testParam": 123},
            "id": 2
        });
        server.runServer(function(){
            helper.connectAndAuthorize(gameVersion, function authorized(error, ws) {
                if (error) {
                    done(error);
                    return;
                }
                ws.send(testRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    assert.equal(answer.result.testParam, 123);
                    server.close(function (error) {
                        done(error);
                    });
                });
            });
        });
    });

    it('accepts batch request in array and return multiple responses in array', function(done){
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

    it('correctly accepts batch request with invalid requests and process only valid ones', function(done){
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

    it('runs server with specified websocket server', function(done){
        const wss = new WebSocket.Server({ port: ++helper.port });
        var server = new RDataServer({ dbUrl: dbUrl, exposedAnonymously: {'test': testMethod }, server: wss });
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

    it('runs multiple rdata servers using one websocket server and different locations', function(done){
        const wss = new WebSocket.Server({ port: ++helper.port });
        const location1 = '/game1';
        const location2 = '/game2';
        var server1 = new RDataServer({ location: location1, dbUrl: dbUrl, exposedAnonymously: {'test': testMethod }, server: wss });
        var server2 = new RDataServer({ location: location2, dbUrl: dbUrl, server: wss });
        var requstId = "UNIQUEREQUESTGUID123";
        var testParams = {"testParam": 123};
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "test",
            "id": requstId,
            "params": testParams
        });

        server1.runServer(function(){
            server2.runServer(function(){
                // Test server 1
                var ws1 = new WebSocket('ws://localhost:'+helper.port+location1);
                ws1.on('open', function open(){
                    ws1.send(testRequest);
                });
                ws1.on('message', function message(data, flags){
                    var answer = JSON.parse(data);
                    assert(answer.id === requstId);
                    assert.deepEqual(answer.result, testParams);

                    // Test server 2
                    var ws2 = new WebSocket('ws://localhost:'+helper.port+location2);
                    ws2.on('open', function open(){
                        ws2.send(testRequest);
                        ws2.on('message', function message(data, flags) {
                            var answer = JSON.parse(data);
                            assert(answer.id === requstId);
                            assert(answer.error); // Should error out since we didn't expose method on the second server
                            assert(answer.error.code === (new JsonRpc.JsonRpcErrors.MethodNotFound()).code);

                            server1.close(function(error) {
                                if(error) return done(error);
                                server2.close(function(error) {
                                    return done(error);
                                });
                            });

                        });
                    });
                });
            });
        });
    });
});