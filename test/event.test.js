/**
 * Events
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
const port = helper.port;

const collectionName = require('../lib/event').eventCollectionName;

describe('RDataEvent', function() {

    beforeEach(function(done) {
        helper.clearTestDatabase(done);
    });

    afterEach(function(done){
        helper.clearTestDatabase(done);
    });

    it('logs the event', function(done){
        var server = new RDataServer({ port: port, dbUrl: dbUrlTest });
        var clientDate = new Date().getTime();
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "logEvent",
            "params": {"eventType": "TestEvent", "data": { "clientDate": clientDate }},
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

                    // Lets find our event in test database
                    helper.getTestDatabase(function(db){
                        db.collection(collectionName).find().limit(1).next(function(err, event){
                            assert(event.data.clientDate == clientDate);

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
