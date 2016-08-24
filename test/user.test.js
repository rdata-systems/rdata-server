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

describe('RDataUserVariable', function() {

    beforeEach(function(done) {
        helper.clearTestDatabase(done);
    });

    afterEach(function(done){
        helper.clearTestDatabase(done);
    });

    it('inserts user variable', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });
        var variableValue = { "var": 1234 };
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "insertVariable",
            "params": {"key": "TestVariable", "value": variableValue},
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
                    helper.getTestDatabase(function(db){
                        db.collection(userVariableCollectionName).find({"key": "TestVariable"}).limit(1).next(function(err, variable){
                            if(err){
                                done(err);
                                return;
                            }
                            assert(variable);
                            assert.deepEqual(variable.value, variableValue);
                            // Close the server
                            server.close(function(error) {
                                done(error);
                            });
                        });
                    });
                });
            });
        });
    });
});
