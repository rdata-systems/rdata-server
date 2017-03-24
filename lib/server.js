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

const RDataBulkRequestController = require('./bulk-request').RDataBulkRequestController;
const RDataEventController = require('./event').RDataEventController;
const RDataUserController = require('./user').RDataUserController;
const RDataContextController = require('./context').RDataContextController;

function RDataServer(options){

    var self = this;

    // Server as EventEmitter
    EventEmitter.call(this);

    // Options
    options = merge({
        port: 80,
        host: '0.0.0.0',
        dbUrl: 'mongodb://localhost:27017/data',
        controllers: {},
        exposed: {},
        exposedAnonymously: {},
    }, options);

    /**
     * Inits the MongoDB
     */
    self.init = function(callback){
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

            connection.on('batch request', function(request){
                self.emit('batch request', connection, request);
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

    self.addController = function(Controller, controllerName, callback){
        options.controllers[controllerName] = Controller;
        if(typeof callback === 'function')
            callback();
    };

    self.initController = function(Controller, callback){
        var controller = Controller(self);
        self.exposed = merge(self.exposed, controller.exposed);
        self.exposedAnonymously = merge(self.exposedAnonymously, controller.exposedAnonymously);

        if(typeof controller.init === 'function') {
            controller.init(function (error) {
                callback(error, controller);
            });
        } else {
            callback(null, controller);
        }

        return controller;
    };

    self.initControllers = function(callback){
        // Initialize other controllers
        var controllerError = null;

        var controllers = merge(self.defaultControllers, options.controllers);
        async.forEach(Object.keys(controllers), function (controllerName, cb) {
            self.controllers[controllerName] = self.initController(controllers[controllerName], cb);
        }, function (err) {
            controllerError = err;
        });

        if(controllerError){
            callback(controllerError);
            return;
        }

        // Finally, expose methods from options (those will overwrite any controller methods)
        self.exposed = merge(self.exposed, options.exposed);
        self.exposedAnonymously = merge(self.exposedAnonymously, options.exposedAnonymously);

        callback(null, true);

    };

    /**
     * Run the server
     * @param {function} [callback] - Callback that runs when server is started
     */
    self.runServer = function(callback) {

        // Init async
        async.series([
            self.init,
            self.initControllers,
            self.initWebsocketServer,
        ], function(err, results) {
            if(typeof callback === 'function') {
                if (err)
                    callback(err);
                else
                    callback(null, true);
            }
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

    self.processRequest = function(connection, request, callback){
        if(!request){
            callback(null, new JsonRpc.JsonRpcResponse({
                error: new JsonRpc.JsonRpcErrors.InvalidRequest(),
            }));
            return;
        }

        var method = request.method;
        var params = request.params;
        var requestId;

        if(typeof request.id === "number")
            requestId = parseInt(request.id);
        else if(typeof request.id === "string")
            requestId = request.id;
        else
            requestId = null;

        if(request.isNotification){
            callback(null, new JsonRpc.JsonRpcResponse({
                error: new errors.JsonRpcErrors.NotificationsNotSupported(),
                id: requestId
            }));
        }

        if(self.exposed[method] && !connection.authorized){
            callback(null, new JsonRpc.JsonRpcResponse({
                error: new errors.JsonRpcErrors.NonAuthorized(),
                id: requestId
            }));
        } else {
            var target;
            if(typeof self.exposed[method] === 'function') {
                target = self.exposed;
            } else if(typeof self.exposedAnonymously[method] === 'function') {
                target = self.exposedAnonymously;
            } else {
                callback(null, new JsonRpc.JsonRpcResponse({
                    error: new JsonRpc.JsonRpcErrors.MethodNotFound(method),
                    id: requestId
                }));
                return;
            }

            // Execute the command
            self.emit('user execute ' + method);
            target[method](connection, params, function(error, result) {
                if(error){
                    if(!error.code){ // This is an exception.. re-create using InternalError
                        error = new JsonRpc.JsonRpcErrors.ServerError(error.message);
                    }
                    callback(null, new JsonRpc.JsonRpcResponse({
                        error: error,
                        id: requestId
                    }));
                } else {
                    // Send result
                    callback(null, new JsonRpc.JsonRpcResponse({
                        result: result === undefined ? null : result,
                        id: requestId
                    }));
                }
            });
        }
    };

    self.on('request', function(connection, request){
        self.processRequest(connection, request, function(error, response){
            connection.send(response);
        });
    });

    self.on('batch request', function(connection, requests){
        var tasks = []; // Build tasks array with functions that will be called in async.parallel
        requests.forEach(function(request){
            tasks.push(function(callback){
                self.processRequest(connection, request, callback);
            });
        });
        async.series(tasks, function(error, responses){
            connection.send(responses);
        });

    });

    self.defaultControllers = {
        'bulkRequestController': RDataBulkRequestController,
        'eventController': RDataEventController,
        'userController': RDataUserController,
        'contextController': RDataContextController
    };

    self.options = options;
    self.db = null;
    self.connections = [];
    self.controllers = {};
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
