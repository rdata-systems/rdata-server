/**
 * Bulk request controller tests
 */

const RDataServer = require('../lib/server');
const JsonRpc = require('../lib/json-rpc');
const errors = JsonRpc.JsonRpcErrors;
const helper = require('./helper');
const WebSocket = require('ws');
const assert = require('assert');
const mocha = require('mocha');

const jsonRpcVersion = helper.jsonRpcVersion;
const gameVersion = helper.gameVersion;
const dbUrl = helper.dbUrl;

describe('RDataBulkRequest', function() {
    it('executes multiple requests using bulk request', function(done){

        // Since bulk request doesn't return any responses from the actual requests,
        // Let's use local variable in this test to check if all requests were successfully executed
        var testCounter = 0;
        var testMethod = function(client, params, callback) {
            testCounter++;
            callback(null, true);
        };

        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl, exposed: {'test': testMethod }});
        var bulkRequestId = "GUIDBULKREQUEST123";
        var requests = [
            {
                "jsonrpc": jsonRpcVersion,
                "method": "test",
                "id": "GUID001",
                "params": {
                    "testParam": 1
                }
            },
            {
                "jsonrpc": jsonRpcVersion,
                "method": "test",
                "id": "GUID002",
                "params": {
                    "testParam": 2
                }
            }
        ];

        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "bulkRequest",
            "id": bulkRequestId,
            "params": {
                "requests": requests
            }
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
                    assert(answer.id == bulkRequestId);
                    assert(!answer.error);
                    assert.equal(answer.result, true);

                    // Since we have 2 actual requests in the bulk request, this variable should be incremented twice
                    assert.equal(testCounter, 2);

                    server.close(function (error) {
                        done(error);
                    });
                });
            });
        });
    });

    it('returns an error when at least one actual request in the bulk request is invalid', function(done){

        // Since bulk request doesn't return any responses from the actual requests,
        // Let's use local variable in this test to check if all requests were successfully executed
        var testCounter = 0;
        var testMethod = function(client, params, callback) {
            testCounter++;
            callback(null, true);
        };

        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl, exposed: {'test': testMethod }});
        var bulkRequestId = "GUIDBULKREQUEST123";
        var requests = [
            {
                "jsonrpc": jsonRpcVersion,
                "method": "test",
                "id": "GUID001",
                "params": {
                }
            },
            {
                "jsonrpc": jsonRpcVersion,
                "method": "test",
                "id": {}, // Invalid request - id must be either string or number
                "params": {
                }
            }
        ];

        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "bulkRequest",
            "id": bulkRequestId,
            "params": {
                "requests": requests
            }
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
                    assert(answer.id == bulkRequestId);
                    assert(answer.error);
                    assert(answer.error.code == (new JsonRpc.JsonRpcErrors.InvalidRequest()).code);

                    // Only second method should succeed, first one should generate an error
                    assert.equal(testCounter, 1);

                    server.close(function (error) {
                        done(error);
                    });
                });
            });
        });
    });

    it('returns an error when at least one actual request in the bulk request has invalid method', function(done){

        // Since bulk request doesn't return any responses from the actual requests,
        // Let's use local variable in this test to check if all requests were successfully executed
        var testCounter = 0;
        var testMethod = function(client, params, callback) {
            testCounter++;
            callback(null, true);
        };

        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl, exposed: {'test': testMethod }});
        var bulkRequestId = "GUIDBULKREQUEST123";
        var requests = [
            {
                "jsonrpc": jsonRpcVersion,
                "method": "test",
                "id": "GUID001",
                "params": {
                }
            },
            {
                "jsonrpc": jsonRpcVersion,
                "method": "invalidMethod", // Invalid request - method is invalid
                "id": "GUID001",
                "params": {
                }
            }
        ];

        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "bulkRequest",
            "id": bulkRequestId,
            "params": {
                "requests": requests
            }
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
                    assert(answer.id == bulkRequestId);
                    assert(answer.error);
                    assert(answer.error.code == (new JsonRpc.JsonRpcErrors.MethodNotFound()).code);

                    // Only second method should succeed, first one should generate an error
                    assert.equal(testCounter, 1);

                    server.close(function (error) {
                        done(error);
                    });
                });
            });
        });
    });

    it('ignores bulk request inside another bulk request', function(done){

        // Since bulk request doesn't return any responses from the actual requests,
        // Let's use local variable in this test to check if all requests were successfully executed
        var testCounter = 0;
        var testMethod = function(client, params, callback) {
            testCounter++;
            callback(null, true);
        };

        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrl, exposed: {'test': testMethod }});
        var bulkRequestId = 1;

        // Bulk "test" request, then bulk request with another test request.
        // This will be used as an array of request for top-level bulk request.
        var requests = [
            {
                "jsonrpc": jsonRpcVersion,
                "method": "test",
                "id": 2,
                "params": {}
            },
            {
                "jsonrpc": jsonRpcVersion,
                "method": "bulkRequest",
                "id": 3,
                "params": {
                    "requests":[
                        {
                            "jsonrpc": jsonRpcVersion,
                            "method": "test",
                            "id": 4,
                            "params": {}
                        }
                    ]
                }
            }
        ];

        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "bulkRequest",
            "id": bulkRequestId, // 1
            "params": {
                "requests": requests
            }
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
                    assert(answer.id == bulkRequestId);
                    assert(answer.error);
                    assert(answer.error.code == (new JsonRpc.JsonRpcErrors.InvalidRequest()).code);

                    // Only first "test" method should be called. Inner bulk request and all it's requests must be ignored.
                    assert.equal(testCounter, 1);

                    server.close(function (error) {
                        done(error);
                    });
                });
            });
        });
    });

});
