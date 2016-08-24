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

const userVariableCollectionName = require('../lib/user').userVariableCollectionName;

var validateUserVariable = function(key, value, callback){
    helper.getTestDatabase(function(error, db){
        if(error){
            callback(error);
            return;
        }
        db.collection(userVariableCollectionName).find({key: key}).limit(1).next(function(err, variable){
            if(err){
                callback(err);
                return;
            }
            assert(variable);
            assert.deepEqual(variable.value, value);
            callback(null, true);
        });
    });
};

describe('RDataUserVariable', function() {

    beforeEach(function(done) {
        helper.clearTestDatabase(done);
    });

    afterEach(function(done){
        helper.clearTestDatabase(done);
    });

    it('inserts user variable', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });
        var key = "TestVariable";
        var variableValue = { "var": 1234 };
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "insertVariable",
            "params": {"key": key, "value": variableValue},
            "id": 1
        });
        server.runServer(function(){
            helper.connectAndAuthenticate(function authenticated(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(testRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    assert(answer.result);

                    // Lets find our variable in the test database
                    validateUserVariable(key, variableValue, function(error, result){
                        if(error){
                            done(error);
                            return;
                        }
                        // Close the server
                        server.close(function(error) {
                            done(error);
                        });
                    });
                });
            });
        });
    });

    it('replaces user variable using key', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });
        var oldVariableValue = { "var": 1234 };
        var newVariableValue = { "var": 4321 };
        var key = "TestVariable";
        var insertRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "insertVariable",
            "params": {"key": key, "value": oldVariableValue },
            "id": 1
        });
        var replaceRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "replaceVariable",
            "params": {"key": key, "value": newVariableValue },
            "id": 2
        });
        server.runServer(function(){
            helper.connectAndAuthenticate(function authenticated(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(insertRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    if(answer.id == 1) { // Response to insertVariable
                        assert(answer.result);
                        // Now, replace the inserted variable
                        ws.send(replaceRequest);
                    }
                    else if(answer.id == 2){ // Response to replaceVariable
                        assert(answer.result);
                        validateUserVariable(key, newVariableValue, function(error, result){
                            if(error){
                                done(error);
                                return;
                            }
                            // Close the server
                            server.close(function(error) {
                                done(error);
                            });
                        });
                    }
                });
            });
        });
    });


    it('replaces user variable using filter', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });
        var oldVariableValue = { "var": 1234 };
        var newVariableValue = { "var": 4321 };
        var key = "TestVariable";
        var filter = { "value": {"var": 1234} };
        var insertRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "insertVariable",
            "params": {"key": key, "value": oldVariableValue },
            "id": 1
        });
        var replaceRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "replaceVariable",
            "params": {"filter": filter, "key": key, "value": newVariableValue },
            "id": 2
        });
        server.runServer(function(){
            helper.connectAndAuthenticate(function authenticated(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(insertRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    if(answer.id == 1) { // Response to insertVariable
                        assert(answer.result);
                        // Now, replace the inserted variable
                        ws.send(replaceRequest);
                    }
                    else if(answer.id == 2){ // Response to replaceVariable
                        assert(answer.result);
                        validateUserVariable(key, newVariableValue, function(error, result){
                            if(error){
                                done(error);
                                return;
                            }
                            // Close the server
                            server.close(function(error) {
                                done(error);
                            });
                        });
                    }
                });
            });
        });
    });

    it('updates user variable', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });
        var oldVariableValue = { "var": 1234 };
        var newVariableValue = { "var": 4321 };
        var key = "TestVariable";
        var insertRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "insertVariable",
            "params": {"key": key, "value": oldVariableValue },
            "id": 1
        });
        var updateRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "updateVariable",
            "params": {"key": key, "value": newVariableValue },
            "id": 2
        });
        server.runServer(function(){
            helper.connectAndAuthenticate(function authenticated(error, ws) {
                if(error){
                    done(error);
                    return;
                }

                ws.send(insertRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    if(answer.id == 1) { // Response to insertVariable
                        assert(answer.result);
                        // Now, replace the inserted variable
                        ws.send(updateRequest);
                    }
                    else if(answer.id == 2){ // Response to replaceVariable
                        assert(answer.result);
                        validateUserVariable(key, newVariableValue, function(error, result){
                            if(error){
                                done(error);
                                return;
                            }
                            // Close the server
                            server.close(function(error) {
                                done(error);
                            });
                        });
                    }
                });
            });
        });
    });
});
