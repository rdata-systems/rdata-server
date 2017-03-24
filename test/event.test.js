/**
 * Event tests
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

const eventCollectionName = require('../lib/event').eventCollectionName;

var validateEventLogged = function (eventName, eventData, contextId, callback){
    helper.getTestDatabase(function(error, db){
        if(error){
            callback(error);
            return;
        }

        db.collection(eventCollectionName).find({name: eventName}).limit(1).next(function(err, event){
            if(err){
                callback(err);
                return;
            }
            assert(event);
            assert.deepEqual(event.data, eventData);
            assert.equal(event.contextId, contextId);
            callback(null, true);
        });
    });
};

var getNumEventsLogged = function(eventName, callback){
    helper.getTestDatabase(function(error, db){
        if(error){
            callback(error);
            return;
        }

        var cursor = db.collection(eventCollectionName).find({name: eventName});
        cursor.count(function(error, count) {
            if(error){
                callback(error);
            } else {
                callback(null, count);
            }
        });
    });
};

describe('RDataEvent', function() {

    beforeEach(function(done) {
        helper.clearTestDatabase(done);
    });

    afterEach(function(done){
        helper.clearTestDatabase(done);
    });

    it('logs the event with the context id', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });
        var clientDate = new Date().getTime();
        var eventName = "TestEvent";
        var eventData = { "clientDate": clientDate };
        var context = {
            "id": "000000010102020202020202020202",
            "name": "TestContext",
            "data": {"testContextInfo": 123},
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
            "params": {"id": "000102030405060708090A0B0C0D0E0F", "name": eventName, "data": eventData, "contextId": context.id },
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

                    if(answer.id == 1) {
                        ws.send(logEventRequest);

                    } else if (answer.id == 2){
                        // Lets find our event in test database
                        validateEventLogged(eventName, eventData, context.id, function (error, result) {
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


    it('logs the event without the context id', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });
        var clientDate = new Date().getTime();
        var eventName = "TestEvent";
        var eventData = { "clientDate": clientDate };
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "logEvent",
            "params": {"id": "000102030405060708090A0B0C0D0E0F", "name": eventName, "data": eventData },
            "id": 1
        });
        server.runServer(function(){
            helper.connectAndAuthorize(function authorized(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(testRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    assert(answer.result);

                    // Lets find our event in test database
                    validateEventLogged(eventName, eventData, null, function (error, result) {
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


    it('logs the same event twice, should not log it second time and return false in the result', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });
        var clientDate = new Date().getTime();
        var eventName = "TestEvent";
        var eventData = { "clientDate": clientDate };
        var eventId = "000102030405060708090A0B0C0D0E0F";
        var testRequest1 = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "logEvent",
            "params": {"id": eventId, "name": eventName, "data": eventData },
            "id": 1
        });
        var testRequest2 = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "logEvent",
            "params": {"id": eventId, "name": eventName, "data": eventData },
            "id": 2
        });
        server.runServer(function(){
            helper.connectAndAuthorize(function authorized(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(testRequest1);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    if(answer.id == 1) {
                        // Lets find our event in test database
                        validateEventLogged(eventName, eventData, null, function (error, result) {
                            if (error) {
                                done(error);
                                return;
                            }

                            // Now, let's log second event
                            ws.send(testRequest2);
                        });
                    } else if(answer.id == 2){
                        // Answer result must be false
                        assert.equal(answer.result, false);

                        // Check that we only have 1 event in the database
                        getNumEventsLogged(eventName, function(err, count){
                            if(err){
                                done(err);
                                return;
                            }

                            assert.equal(count, 1);

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
