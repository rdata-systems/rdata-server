'use strict';

const async = require('async');
const errors = require('./json-rpc').JsonRpcErrors;
const exceptions = require('./errors').Exceptions;

/**
 * Client context.
 * Context might have parent context.
 * If the context has child contexts, they will be closed when the parent context is closed
 */

const contextCollectionName = 'contexts';

/**
 * Basic RDataContext structure
 * @param user
 * @param id
 * @param name
 * @param parentContextId
 * @param timeStarted
 * @param data
 * @param status
 * @constructor
 */
function RDataContext(user, id, name, parentContextId, timeStarted, data, status){
    var self = this;
    self._id = id;
    self.name = name;
    self.status = status || "started";
    self.parentContextId = parentContextId || null;
    self.children = [];
    self.data = data || null;

    self.timeStarted = timeStarted || Date.now();
    self.timeEnded = null;
    self.userId = user.userId;
}

function RDataContextController(server){

    if (this instanceof RDataContextController === false) {
        return new RDataContextController(server);
    }

    var self = this;
    self.server = server;
    self.db = server.db;

    // When user is disconnected from server, interrupt user contexts
    server.on('user disconnected', function(connection){
        if(connection.authenticated)
            self.interruptUserContexts(connection, Date.now());
    });

    self.init = function(callback){
        self.db.collection(contextCollectionName).createIndexes(
            [{"key": {"userId": 1}}, {"key": {"parentContextId": 1}}],
            function(err, result) {
                if(typeof callback === 'function')
                    err ? callback(err, null) : callback(null, result);
            }
        );
        return self;
    };

    self.endContextRecursive = function(connection, id, timeEnded, callback){
        // End this context
        self.db.collection(contextCollectionName).updateOne(
            { userId: connection.user.userId, _id: id },
            { "$set": { "status": "ended", "timeEnded": timeEnded  } },
            function(err, result) {
                if(err) {
                    callback(err);
                } else {
                    // Find it's child contexts and end them
                    var callbackSeries = [];
                    var cursor = self.db.collection(contextCollectionName).find({userId: connection.user.userId, parentContextId: id });
                    cursor.toArray(function(error, result) {
                        if (error) {
                            callback(error);
                            return;
                        }
                        if(result) {
                            for (var i = 0; i < result.length; i++) {
                                var context = result[i];
                                const contextId = context._id;
                                callbackSeries.push(function(cb){
                                    self.endContextRecursive(connection, contextId, timeEnded, cb)
                                });
                            }
                            async.series(callbackSeries, callback);
                        }
                    });
                }
            }
        );

    };

    self.findContext = function findContext(userId, contextId, callback){
        self.db.collection(contextCollectionName).find({userId: userId, _id: contextId}).limit(1).next(function(err, context) {
            if(err){
                callback(err);
            } else {
                callback(null, context);
            }
        });
    };

    self.validateContextExists = function validateContextExists(userId, contextId, callback){
        self.findContext(userId, contextId, function(error, result){
            if(error){
                callback(error);
            } else if(result === null){
                callback(exceptions.ContextValidationError());
            } else {
                callback(null);
            }
        });
    };

    self.insertContext = function insertContext(context, callback){
        self.db.collection(contextCollectionName).insertOne(context, function(err, result) {
           if(err){
               callback(err);
           } else {
               callback(null, result);
           }
        });
    };

    self.addChildContext = function addChildContext(userId, parentContextId, childContextId, callback){
        self.db.collection(contextCollectionName).updateOne(
            { userId: userId, _id: parentContextId },
            { "$push": { "children": childContextId } },
            function(err, result) {
                if(err) {
                    callback(err);
                } else {
                    callback(null, result);
                }
            }
        );
    };

    self.addContextStartedEvent = function addContextStartedEvent(connection, context, callback){
        var eventOptions = {
            name: "StartContextEvent",
            data: {
                id: context.id,
                name: context.name,
                parentContextId: context.parentContextId,
                timeStarted: context.timeStarted,
                timeEnded: context.timeEnded,
                data: context.data,
            }
        };
        self.server.controllers.eventController.logEvent(connection, eventOptions, callback);
    };

    self.startContext = function(connection, params, callback) {
        if (!params.id) {
            callback(new errors.InvalidParams("id"));
            return;
        }
        if (!params.name) {
            callback(new errors.InvalidParams("name"));
            return;
        }

        var context = new RDataContext(connection.user, params.id, params.name, params.parentContextId, params.timeStarted, params.data);

        if(params.parentContextId){ // If parent context id is provided, find it and add this one to it's children
            self.validateContextExists(connection.user.userId, params.parentContextId, function onContextValidation(error){
                if(error) return callback(error);
                self.insertContext(context, function onContextInserted(error, result){
                    if(error) return callback(error);
                    self.addChildContext(connection.user.userId, params.parentContextId, context._id, function(error, result){
                        if(error) return callback(error);
                        self.addContextStartedEvent(connection, context, callback);
                    });
                });
            });

        } else { // No parent context provided, simply insert a context
            self.insertContext(context, function onContextInserted(error, result){
                if(error) return callback(error);
                self.addContextStartedEvent(connection, context, callback);
            });
        }
    };

    self.endContext = function(connection, params, callback){
        if (!params.id) {
            callback(new errors.InvalidParams("id"));
            return;
        }
        var timeEnded = params.timeEnded || Date.now();

        self.endContextRecursive(connection, params.id, timeEnded, function(error, result){
            if(error){
                callback(error);
            } else {
                var eventOptions = {
                    name: "EndContextEvent",
                    data: {
                        id: params.id,
                        timeEnded: timeEnded
                    }
                };
                self.server.controllers.eventController.logEvent(connection, eventOptions, callback);
            }
        });
    };

    self.interruptUserContexts = function(connection, timeInterrupted, callback){
        callback = typeof callback == "function" ? callback : function(){};
        timeInterrupted = timeInterrupted || Date.now();

        self.db.collection(contextCollectionName).updateMany(
            { userId: connection.user.userId, status: "started"  },
            { "$set": { "status": "interrupted", "timeInterrupted": timeInterrupted } },
            function(err, result) {
                if(err) {
                    callback(err);
                } else {
                    var eventOptions = {
                        name: "InterruptUserContextsEvent",
                        data: {
                            timeInterrupted: timeInterrupted
                        }
                    };
                    self.server.controllers.eventController.logEvent(connection, eventOptions, callback);
                }
            }
        );
    };

    self.restoreContexts = function(connection, params, callback){
        callback = typeof callback == "function" ? callback : function(){};
        var timeRestored = Date.now();

        self.db.collection(contextCollectionName).updateMany(
            { userId: connection.user.userId, status: "interrupted" },
            { "$set": { "status": "started", "timeRestored": timeRestored } },
            function(err, result) {
                if(err) {
                    callback(err);
                } else {
                    var eventOptions = {
                        name: "RestoreUserContextsEvent",
                        data: {
                            id: params.id,
                            timeRestored: timeRestored
                        }
                    };
                    self.server.controllers.eventController.logEvent(connection, eventOptions, callback);
                }
            }
        );
    };

    self.exposed = {
        startContext: self.startContext,
        endContext: self.endContext,
        restoreContexts: self.restoreContexts
    };
}

module.exports = {
    contextCollectionName: contextCollectionName,
    RDataContextController: RDataContextController
};