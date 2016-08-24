/**
 *  RDataServer: Data Collection Server based on websockets
 */

'use strict';

const util = require('util');
const merge = require('merge');
const EventEmitter = require('events').EventEmitter;
const ws = require('ws');
const async = require('async');
const MongoClient = require('mongodb').MongoClient;
const JsonRpc = require('./json-rpc');
const errors = require('./errors');

const RDataConnection = require('./connection').RDataConnection;
const RDataEventController = require('./event').RDataEventController;
const RDataUserController = require('./user').RDataUserController;

function RDataServer(options){

    var self = this;

    // Server as EventEmitter
    EventEmitter.call(this);

    // Options
    options = merge({
        port: 80,
        host: '0.0.0.0',
        dbUrl: 'mongodb://localhost:27017/data',
    }, options);

    /**
     * Inits the MongoDB
     */
    self.initDb = function(callback){
        MongoClient.connect(self.options.dbUrl, function(err, db) {
            if(err) {
                self.emit('error', err);
                callback(err, null);
            } else {
                self.db = db;
                self.emit('db ready', db);
                callback(null, db);
            }
        });
    };

    /**
     * Init websocket server
     * @param {function} callback
     */
    self.initWebsocketServer = function(callback){
        self.wss = new ws.Server(options, callback);

        // Server websocket
        self.wss.on('connection', function(websocket) {
            // Accept websocket
            var connection = new RDataConnection(websocket);
            self.connections.push(connection);

            connection.on('request', function(request){
                self.emit('request', connection, request);
            });

            connection.on('close', function(){
                self.emit('user disconnected', connection);

                var index = self.connections.indexOf(connection);
                if (index != -1) {
                    self.connections.splice(index, 1);
                }
            });

            self.emit('user connected', connection);
        });
    };

    /**
     * Expose the single method
     * @param {string} name
     * @param {function} method
     * @param {boolean} [anonymous=false]
     */
    self.exposeMethod = function(name, method, anonymous){
        anonymous = anonymous || false;
        var targetObject;
        if(anonymous)
            targetObject = self.exposedAnonymously;
        else
            targetObject = self.exposed;

        if(!targetObject[name])
            targetObject[name] = method;
    };

    /**
     * Expose the multiple methods at once
     * @param {Object} methods
     * @param {boolean} [anonymous=false]
     */
    self.exposeMethods = function(methods, anonymous){
        for(var name in methods){
            self.exposeMethod(name, methods[name], anonymous);
        }
    };

    /**
     * Run the server
     * @param {function} [callback] - Callback that runs when server is started
     */
    self.runServer = function(callback) {

        // Init async
        async.series([
            // Initialize the database
            self.initDb,

            // Init the controllers
            function(callback){
                self.eventController = new RDataEventController(self.db).init(function initialized(error, result){
                    if(error) {
                        callback(error);
                    } else {
                        self.exposeMethod('logEvent', self.eventController.logEvent);
                        callback(null, true);
                    }
                });
            },
            function(callback){
                self.userController = new RDataUserController(self.db, self.eventController).init(function initialized(error, result){
                    if(error) {
                        callback(error);
                    } else {
                        self.exposeMethod('authenticate', self.userController.authenticate, true);
                        self.exposeMethods({
                            'insertVariable': self.userController.insertVariable,
                            'replaceVariable': self.userController.replaceVariable,
                            'updateVariable': self.userController.updateVariable,
                        });
                        callback(null, true);
                    }
                });
            },

            // Finally, start the websocket server
            self.initWebsocketServer,

        ], function(err, results) {
            if(err)
                callback(err);
            else
                callback(null, true);
        });
    };

    /**
     * Shuts down the server
     * @param {function} [callback] - callback called when the server is closed
     */
    self.close = function(callback){
        var error = null;
        self.wss.close(function(wssError){
            if(callback) {
                var error = error || wssError;
                if(error)
                    callback(error);
                else
                    callback(null, true);
            }
        });
    };

    self.on('request', function(client, request){
        var method = request.method;
        var params = request.params;
        var requestId = request.id || null;

        if(request.isNotification){
            client.send(new JsonRpc.JsonRpcResponse({
                error: new errors.JsonRpcErrors.NotificationsNotSupported(),
                id: requestId
            }));
        }

        if(!self.exposedAnonymously[method] && !client.authenticated){
            client.send(new JsonRpc.JsonRpcResponse({
                error: new errors.JsonRpcErrors.NonAuthenticated(),
                id: requestId
            }));
        } else {
            var target;
            if(typeof self.exposed[method] === 'function') {
                target = self.exposed;
            } else if(typeof self.exposedAnonymously[method] === 'function') {
                target = self.exposedAnonymously;
            } else {
                client.send(new JsonRpc.JsonRpcResponse({
                    error: new JsonRpc.JsonRpcErrors.MethodNotFound(),
                    id: requestId
                }));
                return;
            }

            // Execute the command
            self.emit('client execute ' + method);
            target[method](client, params, function callback(error, result) {
                if(error){
                    if(!error.code){ // This is an exception.. re-create using InternalError
                        error = new JsonRpc.JsonRpcErrors.InternalError(error.message);
                    }
                    client.send(new JsonRpc.JsonRpcResponse({
                        error: error,
                        id: requestId
                    }));
                } else {
                    // Send result
                    client.send(new JsonRpc.JsonRpcResponse({
                        result: result || null,
                        id: requestId
                    }));
                }
            });
        }
    });

    self.on('client disconnected', function(client){
        console.log('Closing websocket: ' + client);
    });

    self.options = options;
    self.db = null;
    self.connections = [];
    self.exposed = {};
    self.exposedAnonymously = {};

    /*
    // Make sure server never crashes
    process.on('uncaughtException', function(err){
        console.error(err);
    });
    */
}

/**
 * Inherits from EventEmitter.
 */

util.inherits(RDataServer, EventEmitter);

module.exports = RDataServer;
