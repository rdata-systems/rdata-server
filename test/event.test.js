/**
 * Events
 */

const RDataServer = require('../lib/rdata-server');
const helper = require('./helper');
const WebSocket = require('ws');
const assert = require('assert');
const DatabaseCleaner = require('database-cleaner');
const mocha = require('mocha');
const beforeEach = mocha.beforeEach;

const databaseCleaner = new DatabaseCleaner('mongodb');
const connect = require('mongodb').connect;
var dbUrlTest = process.env.DB_URL_TEST || 'mongodb://localhost:27017/test';

const jsonRpcVersion = helper.jsonRpcVersion;
const port = helper.port;

describe('hooks', function() {
    beforeEach(function() {
        connect(dbUrlTest, function (err, db) {
            databaseCleaner.clean(db, function () {
                db.close();
            });
        });
    });
});


describe('RDataEvent', function() {
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
            helper.connectAndAuthenticate(function authenticated(ws) {
                ws.send(testRequest);
                ws.on('message', function message(data, flags) {
                    var answer = JSON.parse(data);
                    assert(answer.result);
                    server.close(function () {
                        done();
                    });
                });
            });
        });
    });
});
