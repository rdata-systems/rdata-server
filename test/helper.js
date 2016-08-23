const assert = require('assert');
const WebSocket = require('ws');
const DatabaseCleaner = require('database-cleaner');
const databaseCleaner = new DatabaseCleaner('mongodb');
const connect = require('mongodb').connect;

const jsonRpcVersion = "2.0";
const port = 8899;
const dbUrl =  process.env.DB_URL_TEST || 'mongodb://localhost:27017/test';

module.exports = {
    jsonRpcVersion: jsonRpcVersion,
    port: port,
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
            callback(db);
        });
    },

    /**
     * Connects to the server and authenticates using the default authentication method.
     * @param {function} callback
     */
    connectAndAuthenticate: function (callback) {
        var authRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "authenticate",
            "params": {userId: "test"},
            "id": 1
        });
        var ws = new WebSocket('ws://localhost:' + port);
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
    },
};