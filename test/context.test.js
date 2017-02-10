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
                assert.equal(timeInterrupted, context.timeInterrupted)

            assert.deepEqual(context.data, data);
            callback(null, true);
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
            helper.connectAndAuthenticate(function authenticated(error, ws) {
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
            helper.connectAndAuthenticate(function authenticated(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(startParentContextRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    if (answer.id == 1) {
                        ws.send(startChildContextRequest);
                    } else if (answer.id == 2) {
                        assert(answer.result);
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
            helper.connectAndAuthenticate(function authenticated(error, ws) {
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
            helper.connectAndAuthenticate(function authenticated(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(startContextRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    if(answer.id == 1){
                        ws.send(endContextRequest);
                    } else if (answer.id == 2){
                        assert(answer);
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
            "data": {"testContextInfo": 123},
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
            helper.connectAndAuthenticate(function authenticated(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(startContextRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    if(answer.id == 1){
                        ws.send(endContextRequest);
                    } else if (answer.id == 2){
                        assert(answer);
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

    it('should automatically interrupt contexts when user disconnects', function(done){
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
            helper.connectAndAuthenticate(function authenticated(error, ws) {
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


    it('restores interrupted contexts', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });
        var context = {
            "id": "000102030405060708090A0B0C0D0E0F",
            "name": "TestContext",
            "data": {"testContextInfo": 123},
            "persistent": true
        };
        var startContextRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "startContext",
            "params": {"id": context.id, "name": context.name, "data": context.data},
            "id": 1
        });
        var restoreContextsRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "restoreContexts",
            "params": {},
            "id": 1
        });

        server.runServer(function(){
            helper.connectAndAuthenticate(function authenticated(error, ws) {
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
                            helper.connectAndAuthenticate(function authenticated(error, ws) {
                                if (error) {
                                    done(error);
                                    return;
                                }

                                // Send restore context message
                                ws.send(restoreContextsRequest);
                                ws.on('message', function message(data, flags) {
                                    // Validate that the context is restored
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



    it('should end context tree if the parent context is closed', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });
        var parentContext = {
            "id": "000102030405060708090A0B0C0D0E0F",
            "name": "ParentContext",
            "data": {"testContextInfo": 123},
            "persistent": false
        };
        var childContext = {
            "id": "0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F",
            "name": "ChildContext",
            "data": {"testContextInfo": 456},
            "persistent": false,
            "parentContextId": parentContext.id
        };
        var startParentContextRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "startContext",
            "params": {"id": parentContext.id, "name": parentContext.name, "persistent": parentContext.persistent, "data": parentContext.data},
            "id": 1
        });
        var startChildContextRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "startContext",
            "params": {"id": childContext.id, "parentContextId": childContext.parentContextId, "name": childContext.name, "persistent": childContext.persistent, "data": childContext.data},
            "id": 2
        });
        var endParentContextRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "endContext",
            "params": {"id": parentContext.id },
            "id": 3
        });
        server.runServer(function(){
            helper.connectAndAuthenticate(function authenticated(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(startParentContextRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
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

});
