/**
 * User tests
 */

const RDataServer = require('../lib/server');
const helper = require('./helper');
const WebSocket = require('ws');
const assert = require('assert');
const mocha = require('mocha');
const beforeEach = mocha.beforeEach;
const afterEach = mocha.afterEach;

var dbUrlTest = helper.dbUrl;

const jsonRpcVersion = helper.jsonRpcVersion;

const contextCollectionName = require('../lib/context').contextCollectionName;

var validateContext = function validateContext(id, data, status, timeStarted, timeEnded, timeInterrupted, callback){
    helper.getTestDatabase(function(error, db){
        if(error){
            callback(error);
            return;
        }
        db.collection(contextCollectionName).find({_id: id, status: status}).limit(1).next(function(err, context){
            if(err){
                callback(err);
                return;
            }
            assert(context);
            if(timeStarted)
                assert.equal(timeStarted, context.timeStarted);
            if(timeEnded)
                assert.equal(timeEnded, context.timeEnded);
            if(timeInterrupted)
                assert.equal(timeInterrupted, context.timeInterrupted);

            assert.deepEqual(context.data, data);
            callback(null, true);
        });
    });
};

var waitForContextExists = function waitForContextExists(id, status, callback){
    helper.getTestDatabase(function (error, db) {
        if (error)
            return callback(error);

        db.collection(contextCollectionName).find({_id: id, status: status}).limit(1).next(function (err, context) {
            if (err)
                return callback(err);

            if(context)
                callback(null, true);
            else
                setTimeout(function() { waitForContextExists(id, status, callback) }, 0);
        });
    });
};

var validateContextChild = function validateContextChild(parentContextId, childContextId, callback){
    helper.getTestDatabase(function(error, db){
        if(error) return callback(error);
        db.collection(contextCollectionName).find({_id: parentContextId}).limit(1).next(function(err, context){
            if(err) return callback(err);
            assert(context);
            assert(context.children);
            assert(context.children.indexOf(childContextId) > -1);
            callback(null, true);
        });
    });
};

describe('RDataContext', function() {

    beforeEach(function(done) {
        helper.clearTestDatabase(done);
    });

    afterEach(function(done){
        helper.clearTestDatabase(done);
    });


    it('starts a context', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });
        var context = {
            "id": "000102030405060708090A0B0C0D0E0F",
            "name": "TestContext",
            "data": {"testContextInfo": 123}
        };
        var startContextRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "startContext",
            "params": {"id": context.id, "name": context.name, data: context.data},
            "id": 1
        });
        server.runServer(function(){
            helper.connectAndAuthorize(function authorized(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(startContextRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    assert(answer.result);
                    validateContext(context.id, context.data, "started", null, null, null, function (error, result) {
                        if (error) {
                            done(error);
                            return;
                        }
                        // Close the server
                        server.close(function (error) {
                            done(error);
                        });
                    });
                });
            });
        });
    });

    it('starts a child context with the provided parent context id', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });
        var parentContext = {
            "id": "000102030405060708090A0B0C0D0E0F",
            "name": "ParentContext",
            "data": {"testContextInfo": 123}
        };
        var childContext = {
            "id": "111102030405060708090A0B0C0D0E0F",
            "name": "ChildContext",
            "parentContextId": parentContext.id,
            "data": {"testContextInfo": 456}
        };

        var startParentContextRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "startContext",
            "params": {"id": parentContext.id, "name": parentContext.name, data: parentContext.data},
            "id": 1
        });

        var startChildContextRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "startContext",
            "params": {"id": childContext.id, "parentContextId": childContext.parentContextId, "name": childContext.name, data: childContext.data},
            "id": 2
        });

        server.runServer(function(){
            helper.connectAndAuthorize(function authorized(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(startParentContextRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    assert(answer.result);

                    if (answer.id == 1) {
                        ws.send(startChildContextRequest);
                    } else if (answer.id == 2) {
                        validateContext(childContext.id, childContext.data, "started", null, null, null, function (error, result) {
                            if (error) done(error);

                            validateContextChild(parentContext.id, childContext.id, function (error) {
                                if (error) return done(error);

                                // Close the server
                                server.close(function (error) {
                                    done(error);
                                });
                            });
                        });
                    }
                });
            });
        });
    });


    it('starts a context with custom timeStarted', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });
        var timeStarted = Date.now();
        var context = {
            "id": "000102030405060708090A0B0C0D0E0F",
            "name": "TestContext",
            "timeStarted": timeStarted,
            "data": {"testContextInfo": 123}
        };
        var startContextRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "startContext",
            "params": {"id": context.id, "name": context.name, data: context.data, timeStarted: context.timeStarted},
            "id": 1
        });
        server.runServer(function(){
            helper.connectAndAuthorize(function authorized(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(startContextRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    assert(answer.result);
                    validateContext(context.id, context.data, "started", timeStarted, null, null, function (error, result) {
                        if (error) {
                            done(error);
                            return;
                        }
                        // Close the server
                        server.close(function (error) {
                            done(error);
                        });
                    });
                });
            });
        });
    });

    it('ends a context', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });
        var context = {
            "id": "000102030405060708090A0B0C0D0E0F",
            "name": "TestContext",
            "data": {"testContextInfo": 123}
        };
        var startContextRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "startContext",
            "params": {"id": context.id, "name": context.name, data: context.data},
            "id": 1
        });
        var endContextRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "endContext",
            "params": {"id": context.id },
            "id": 2
        });

        server.runServer(function(){
            helper.connectAndAuthorize(function authorized(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(startContextRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    assert(answer.result);
                    if(answer.id == 1){
                        ws.send(endContextRequest);
                    } else if (answer.id == 2){
                        validateContext(context.id, context.data, "ended", null, null, null, function (error, result) {
                            if (error) {
                                done(error);
                                return;
                            }
                            // Close the server
                            server.close(function (error) {
                                done(error);
                            });
                        });
                    }
                });
            });
        });
    });

    it('ends a context with custom timeEnded', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });
        var timeEnded = Date.now();
        var context = {
            "id": "000102030405060708090A0B0C0D0E0F",
            "name": "TestContext",
            "data": {"testContextInfo": 123}
        };
        var startContextRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "startContext",
            "params": {"id": context.id, "name": context.name, data: context.data},
            "id": 1
        });
        var endContextRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "endContext",
            "params": {"id": context.id, "timeEnded": timeEnded },
            "id": 2
        });

        server.runServer(function(){
            helper.connectAndAuthorize(function authorized(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(startContextRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    assert(answer.result);
                    if(answer.id == 1){
                        ws.send(endContextRequest);
                    } else if (answer.id == 2){
                        validateContext(context.id, context.data, "ended", null, timeEnded, null, function (error, result) {
                            if (error) {
                                done(error);
                                return;
                            }
                            // Close the server
                            server.close(function (error) {
                                done(error);
                            });
                        });
                    }
                });
            });
        });
    });

    it('interrupts the connection context tree when user disconnects', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });
        var context = {
            "id": "000102030405060708090A0B0C0D0E0F",
            "name": "TestContext",
            "data": {"testContextInfo": 123}
        };
        var startContextRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "startContext",
            "params": {"id": context.id, "name": context.name, data: context.data},
            "id": 1
        });
        server.runServer(function(){
            helper.connectAndAuthorize(function authorized(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(startContextRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    assert(answer.result);

                    ws.close();
                    server.on('user disconnected', function(connection){
                        validateContext(context.id, context.data, "interrupted", null, null, null, function (error, result) {
                            if (error) {
                                done(error);
                                return;
                            }
                            // Close the server
                            server.close(function (error) {
                                done(error);
                            });
                        });
                    });
                });
            });
        });
    });

    it('does not interrupt the connection context tree if the context is ended', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });
        var context = {
            "id": "000102030405060708090A0B0C0D0E0F",
            "name": "TestContext",
            "data": {"testContextInfo": 123}
        };
        var startContextRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "startContext",
            "params": {"id": context.id, "name": context.name, data: context.data},
            "id": 1
        });
        var endContextRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "endContext",
            "params": {"id": context.id, "name": context.name, data: context.data},
            "id": 2
        });
        server.runServer(function(){
            helper.connectAndAuthorize(function authorized(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(startContextRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    assert(answer.result);
                    if(answer.id === 1){
                        ws.send(endContextRequest);
                    } else {
                        ws.close();
                        server.on('user disconnected', function (connection) {
                            validateContext(context.id, context.data, "ended", null, null, null, function (error, result) {
                                if (error) {
                                    done(error);
                                    return;
                                }
                                // Close the server
                                server.close(function (error) {
                                    done(error);
                                });
                            });
                        });
                    }
                });
            });
        });
    });


    it('restores the interrupted context tree', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });
        var parentContext = {
            "id": "000102030405060708090A0B0C0D0E0F",
            "name": "GameContext",
            "data": {"testContextInfo": 123}
        };
        var childContext = {
            "id": "123402030405060708090A0B0C0DAAAA",
            "name": "QuestContext",
            "parentContextId": parentContext.id,
            "data": {"testContextInfo": 123}
        };
        var startParentContextRequest = {
            "jsonrpc": jsonRpcVersion,
            "method": "startContext",
            "params": {"id": parentContext.id, "name": parentContext.name, "data": parentContext.data},
            "id": 1
        };
        var startChildContextRequest = {
            "jsonrpc": jsonRpcVersion,
            "method": "startContext",
            "params": {"id": childContext.id, "name": childContext.name, "data": childContext.data, "parentContextId": childContext.parentContextId},
            "id": 2
        };
        var restoreContextRequest = {
            "jsonrpc": jsonRpcVersion,
            "method": "restoreContext",
            "params": {"id": parentContext.id},
            "id": 3
        };

        server.runServer(function(){
            helper.connectAndAuthorize(function authorized(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(JSON.stringify(startParentContextRequest));
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    assert(answer.result);

                    if(answer.id == startParentContextRequest.id){
                        ws.send(JSON.stringify(startChildContextRequest));
                    }

                    else if(answer.id == startChildContextRequest.id) {
                        ws.close();
                        ws = null;

                        var firstUserDisconnected = false;
                        server.on('user disconnected', function (connection) {
                            if (firstUserDisconnected)
                                return;
                            else
                                firstUserDisconnected = true;

                            waitForContextExists(parentContext.id, "interrupted", function (error, result) {
                                waitForContextExists(childContext.id, "interrupted", function (error, result) {
                                    if (error) {
                                        done(error);
                                        return;
                                    }

                                    // Reconnect and restore contexts
                                    helper.connectAndAuthorize(function authorized(error, ws) {
                                        if (error) {
                                            done(error);
                                            return;
                                        }

                                        // Send restore context message
                                        ws.send(JSON.stringify(restoreContextRequest));
                                        ws.on('message', function message(data, flags) {
                                            // Validate that both contexts are restored
                                            validateContext(parentContext.id, parentContext.data, "started", null, null, null, function (error, result) {
                                                validateContext(childContext.id, childContext.data, "started", null, null, null, function (error, result) {
                                                    // Close the server
                                                    server.close(function (error) {
                                                        done(error);
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    }
                });
            });
        });
    });


    it('ends the interrupted context', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });
        var context = {
            "id": "000102030405060708090A0B0C0D0E0F",
            "name": "TestContext",
            "data": {"testContextInfo": 123},
        };
        var startContextRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "startContext",
            "params": {"id": context.id, "name": context.name, "data": context.data},
            "id": 1
        });
        var endContextsRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "endContext",
            "params": {"id": context.id},
            "id": 1
        });

        server.runServer(function(){
            helper.connectAndAuthorize(function authorized(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(startContextRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    assert(answer.result);

                    ws.close();
                    ws = null;

                    var firstUserDisconnected = false;
                    server.on('user disconnected', function (connection) {
                        if(firstUserDisconnected)
                            return;
                        else
                            firstUserDisconnected = true;

                        validateContext(context.id, context.data, "interrupted", null, null, null, function (error, result) {
                            if (error) {
                                done(error);
                                return;
                            }

                            // Reconnect and restore contexts
                            helper.connectAndAuthorize(function authorized(error, ws) {
                                if (error) {
                                    done(error);
                                    return;
                                }

                                // Send restore context message
                                ws.send(endContextsRequest);
                                ws.on('message', function message(data, flags) {
                                    // Validate that the context is ended
                                    validateContext(context.id, context.data, "ended", null, null, null, function (error, result) {
                                        // Close the server
                                        server.close(function (error) {
                                            done(error);
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });


    it('restores the interrupted context when the event is logged under this context', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });
        var context = {
            "id": "000102030405060708090A0B0C0D0E0F",
            "name": "TestContext",
            "data": {"testContextInfo": 123}
        };
        var startContextRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "startContext",
            "params": {"id": context.id, "name": context.name, "data": context.data},
            "id": 1
        });
        var logEventRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "logEvent",
            "params": {"id": "000102030405060708090A0B0C0D0E0F", "name": "testEvent", "data": {"test": "test"}, "contextId": context.id},
            "id": 1
        });

        server.runServer(function(){
            helper.connectAndAuthorize(function authorized(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(startContextRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    assert(answer.result);

                    ws.close();
                    ws = null;

                    var firstUserDisconnected = false;
                    server.on('user disconnected', function (connection) {
                        if(firstUserDisconnected)
                            return;
                        else
                            firstUserDisconnected = true;

                        validateContext(context.id, context.data, "interrupted", null, null, null, function (error, result) {
                            if (error) {
                                done(error);
                                return;
                            }

                            // Reconnect and restore contexts
                            helper.connectAndAuthorize(function authorized(error, ws) {
                                if (error) {
                                    done(error);
                                    return;
                                }

                                // Send restore context message
                                ws.send(logEventRequest);
                                ws.on('message', function message(data, flags) {
                                    var answer = JSON.parse(data);
                                    assert(answer.result);

                                    // Validate that the context is ended
                                    validateContext(context.id, context.data, "started", null, null, null, function (error, result) {
                                        // Close the server
                                        server.close(function (error) {
                                            done(error);
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });


    it('ends the interrupted context tree', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });
        var context = {
            "id": "000102030405060708090A0B0C0D0E0F",
            "name": "TestContext",
            "data": {"testContextInfo": 123}
        };
        var startContextRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "startContext",
            "params": {"id": context.id, "name": context.name, "data": context.data},
            "id": 1
        });
        var endInterruptedContextsRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "endContext",
            "params": {"id": context.id},
            "id": 1
        });

        server.runServer(function(){
            helper.connectAndAuthorize(function authorized(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(startContextRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    assert(answer.result);

                    ws.close();
                    ws = null;

                    var firstUserDisconnected = false;
                    server.on('user disconnected', function (connection) {
                        if(firstUserDisconnected)
                            return;
                        else
                            firstUserDisconnected = true;

                        waitForContextExists(context.id, "interrupted", function (error, result) {
                            if (error) {
                                done(error);
                                return;
                            }

                            // Reconnect and restore contexts
                            helper.connectAndAuthorize(function authorized(error, ws) {
                                if (error) {
                                    done(error);
                                    return;
                                }

                                // Send restore context message
                                ws.send(endInterruptedContextsRequest);
                                ws.on('message', function message(data, flags) {
                                    // Validate that the context is restored
                                    validateContext(context.id, context.data, "ended", null, null, null, function (error, result) {
                                        // Close the server
                                        server.close(function (error) {
                                            done(error);
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    it('ends the context tree if the parent context is ended', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });
        var parentContext = {
            "id": "000102030405060708090A0B0C0D0E0F",
            "name": "ParentContext",
            "data": {"testContextInfo": 123}
        };
        var childContext = {
            "id": "0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F",
            "name": "ChildContext",
            "data": {"testContextInfo": 456},
            "parentContextId": parentContext.id
        };
        var startParentContextRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "startContext",
            "params": {"id": parentContext.id, "name": parentContext.name, "data": parentContext.data},
            "id": 1
        });
        var startChildContextRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "startContext",
            "params": {"id": childContext.id, "parentContextId": childContext.parentContextId, "name": childContext.name, "data": childContext.data},
            "id": 2
        });
        var endParentContextRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "endContext",
            "params": {"id": parentContext.id },
            "id": 3
        });
        server.runServer(function(){
            helper.connectAndAuthorize(function authorized(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(startParentContextRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    assert(!answer.error, "request failed with error: " + JSON.stringify(answer.error));
                    assert(answer.result);

                    if(answer.id == 1){
                        ws.send(startChildContextRequest);
                    } else if(answer.id == 2){
                        ws.send(endParentContextRequest);
                    } else if(answer.id == 3){
                        validateContext(childContext.id, childContext.data, "ended", null, null, null, function (error, result) {
                            if (error) {
                                done(error);
                                return;
                            }
                            // Close the server
                            server.close(function (error) {
                                done(error);
                            });
                        });
                    }
                });
            });
        });
    });

    it('sets a context data', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });
        var context = {
            "id": "000102030405060708090A0B0C0D0E0F",
            "name": "TestContext",
            "data": {}
        };
        var startContextRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "startContext",
            "params": {"id": context.id, "name": context.name, data: context.data},
            "id": 1
        });
        var newContextData = {"myData": {"val": 123, "a": 456}};
        var updateContextDataRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "setContextData",
            "params": {"id": context.id, "data": newContextData },
            "id": 2
        });

        server.runServer(function(){
            helper.connectAndAuthorize(function authorized(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(startContextRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    assert(answer.result);

                    if(answer.id == 1){
                        ws.send(updateContextDataRequest);

                    } else if (answer.id == 2){
                        validateContext(context.id, newContextData, "started", null, null, null, function (error, result) {
                            if (error) {
                                done(error);
                                return;
                            }
                            // Close the server
                            server.close(function (error) {
                                done(error);
                            });
                        });
                    }
                });
            });
        });
    });

    it('updates a value of the context data', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });

        var contextData =        {"myData": {"val": 123, "a": 456}};
        var key = "myData.a";
        var value = 789;
        var updatedContextData = {"myData": {"val": 123, "a": 789}};

        var context = {
            "id": "000102030405060708090A0B0C0D0E0F",
            "name": "TestContext",
            "data": contextData
        };
        var startContextRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "startContext",
            "params": {"id": context.id, "name": context.name, data: context.data},
            "id": 1
        });
        var updateContextDataRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "updateContextDataVariable",
            "params": {"id": context.id, "key": key, "value": value },
            "id": 2
        });

        server.runServer(function(){
            helper.connectAndAuthorize(function authorized(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(startContextRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    assert(answer.result);

                    if(answer.id == 1){
                        ws.send(updateContextDataRequest);

                    } else if (answer.id == 2){
                        validateContext(context.id, updatedContextData, "started", null, null, null, function (error, result) {
                            if (error) {
                                done(error);
                                return;
                            }
                            // Close the server
                            server.close(function (error) {
                                done(error);
                            });
                        });
                    }
                });
            });
        });
    });
});
