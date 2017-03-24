const assert = require('assert');
const WebSocket = require('ws');
const RDataServer = require('../lib/server');
const DatabaseCleaner = require('database-cleaner');
const databaseCleaner = new DatabaseCleaner('mongodb');
const connect = require('mongodb').connect;

const jsonRpcVersion = "2.0";
const dbUrl =  process.env.DB_URL_TEST || 'mongodb://localhost:27017/test';

module.exports = {
    jsonRpcVersion: jsonRpcVersion,
    port: 8899,
    dbUrl: dbUrl,

    /**
     * Clears the test database
     * @param {function} callback
     */
    clearTestDatabase: function(callback){
        connect(dbUrl, function (err, db) {
            if(err) {
                callback(err);
                return;
            }

            databaseCleaner.clean(db, function () {
                db.close(function(){
                    if(callback)
                        callback();
                });
            });
        });
    },

    /**
     * Gets the test database connection
     * @param callback
     */
    getTestDatabase: function(callback){
        connect(dbUrl, function (err, db) {
            callback(err, db);
        });
    },

    /**
     * Connects to the server and authorizes using the default authorization method.
     * @param {function} callback
     */
    connectAndAuthorize: function (callback) {
        var authRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "authorize",
            "params": {userId: "test"},
            "id": 1
        });
        var ws = new WebSocket('ws://localhost:' + module.exports.port);
        ws.on('open', function open() {
            ws.send(authRequest);
        });
        var onMessage = function (data, flags) {
            var answer = JSON.parse(data);
            assert(answer.result);
            ws.removeListener('message', onMessage);
            callback(null, ws);
        };
        ws.on('message', onMessage);
    }
};