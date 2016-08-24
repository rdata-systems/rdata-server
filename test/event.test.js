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

var validateEventLogged = function(eventName, eventData, callback){
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
            callback(null, true);
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

    it('logs the event', function(done){
        var server = new RDataServer({ port: ++helper.port, dbUrl: dbUrlTest });
        var clientDate = new Date().getTime();
        var eventName = "TestEvent";
        var eventData = { "clientDate": clientDate };
        var testRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "logEvent",
            "params": {"name": eventName, "data": eventData },
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
                    validateEventLogged(eventName, eventData, function(error, result){
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
});
