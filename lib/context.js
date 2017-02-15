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

const contextStatusStarted = "started";
const contextStatusEnded = "ended";
const contextStatusInterrupted = "interrupted";

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
    self.status = status || contextStatusStarted;
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
            self.interruptContexts(connection.user, Date.now());
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


    self.startContext = function startContext(user, contextId, contextName, parentContextId, timeStarted, data, callback){
        var context = new RDataContext(user, contextId, contextName, parentContextId, timeStarted, data);

        if(parentContextId){ // If parent context id is provided, find it and add this one to it's children
            self.validateAndRestoreContext(user, parentContextId, timeStarted, function onContextValidation(error){
                if(error) return callback(error);
                self.insertContext(context, function onContextInserted(error, result){
                    if(error) return callback(error);
                    self.addChildContext(user.userId, parentContextId, context._id, function(error, result){
                        if(error) return callback(error);
                        self.addContextStartedEvent(user, context, callback);
                    });
                });
            });

        } else { // No parent context provided, simply insert a context
            self.insertContext(context, function onContextInserted(error, result){
                if(error) return callback(error);
                self.addContextStartedEvent(user, context, callback);
            });
        }
    };

    self.endContext = function endContext(user, contextId, timeEnded, callback){
        self.validateAndRestoreContext(user, contextId, timeEnded, function onContextValidation(error){
            if(error) return callback(error);
            self.endContextRecursive(user, contextId, timeEnded, function(error, result){
                if(error){
                    callback(error);
                } else {
                    var eventOptions = {
                        name: "EndContextEvent",
                        data: {
                            id: contextId,
                            timeEnded: timeEnded
                        }
                    };
                    self.server.controllers.eventController.logEvent(user, eventOptions, callback);
                }
            });
        });
    };

    self.endContextRecursive = function(user, id, timeEnded, callback){
        // End this context
        self.db.collection(contextCollectionName).updateOne(
            { userId: user.userId, _id: id },
            { "$set": { "status": contextStatusEnded, "timeEnded": timeEnded  } },
            function(err, result) {
                if(err) {
                    callback(err);
                } else {
                    // Find it's child contexts and end them
                    var callbackSeries = [];
                    var cursor = self.db.collection(contextCollectionName).find({userId: user.userId, parentContextId: id });
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
                                    self.endContextRecursive(user, contextId, timeEnded, cb)
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

    self.validateAndRestoreContext = function validateContextExists(user, contextId, timeRestored, callback){
        self.findContext(user.userId, contextId, function(error, context){
            if(error){
                callback(error);
            } else if(context === null || context.status == contextStatusEnded) {
                callback(new exceptions.ContextValidationError());
            } else if(context.status == contextStatusInterrupted){
                // Context status is interrupted and we are performing actions on the context. Restore it
                self.restoreContext(user, context, timeRestored, callback);
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

    self.addContextStartedEvent = function addContextStartedEvent(user, context, callback){
        var eventOptions = {
            name: "StartContextEvent",
            data: {
                id: context.id,
                name: context.name,
                parentContextId: context.parentContextId,
                timeStarted: context.timeStarted,
                timeEnded: context.timeEnded,
                data: context.data
            }
        };
        self.server.controllers.eventController.logEvent(user, eventOptions, callback);
    };

    self.restoreContext = function restoreContext(user, context, timeRestored, callback){
        callback = typeof callback == "function" ? callback : function(){};
        timeRestored = timeRestored || Date.now();

        self.db.collection(contextCollectionName).updateOne(
            { userId: user.userId, _id: context._id},
            { "$set": { "status": contextStatusStarted, "timeRestored": timeRestored } },
            function(err, result) {
                if(err) {
                    callback(err);
                } else {
                    var eventOptions = {
                        name: "RestoreUserContextEvent",
                        data: {
                            id: context.id,
                            timeRestored: timeRestored
                        }
                    };
                    self.server.controllers.eventController.logEvent(user, eventOptions, callback);
                }
            }
        );
    };

    self.restoreContexts = function restoreContexts(user, timeRestored, callback){
        self.db.collection(contextCollectionName).updateMany(
            { userId: user.userId, status: contextStatusInterrupted },
            { "$set": { "status": contextStatusStarted, "timeRestored": timeRestored } },
            function(err, result) {
                if(err) {
                    callback(err);
                } else {
                    var eventOptions = {
                        name: "RestoreUserContextsEvent",
                        data: {
                            timeRestored: timeRestored
                        }
                    };
                    self.server.controllers.eventController.logEvent(user, eventOptions, callback);
                }
            }
        );
    };

    self.interruptContexts = function(user, timeInterrupted, callback){
        callback = typeof callback == "function" ? callback : function(){};
        timeInterrupted = timeInterrupted || Date.now();

        self.db.collection(contextCollectionName).updateMany(
            { userId: user.userId, status: "started"  },
            { "$set": { "status": contextStatusInterrupted, "timeInterrupted": timeInterrupted } },
            function(err, result) {
                if(err) {
                    callback(err);
                } else {
                    var eventOptions = {
                        name: "InterruptContextsEvent",
                        data: {
                            timeInterrupted: timeInterrupted
                        }
                    };
                    self.server.controllers.eventController.logEvent(user, eventOptions, callback);
                }
            }
        );
    };

    self.startContextExposed = function(connection, params, callback) {
        if (!params.id) {
            callback(new errors.InvalidParams("id"));
            return;
        }
        if (!params.name) {
            callback(new errors.InvalidParams("name"));
            return;
        }
        self.startContext(connection.user, params.id, params.name, params.parentContextId, params.timeStarted, params.data, callback);
    };

    self.endContextExposed = function(connection, params, callback){
        if (!params.id) {
            callback(new errors.InvalidParams("id"));
            return;
        }
        var timeEnded = params.timeEnded || Date.now();

        self.endContext(connection.user, params.id, timeEnded, callback)
    };


    self.restoreContextsExposed = function(connection, params, callback){
        callback = typeof callback == "function" ? callback : function(){};
        var timeRestored = Date.now();

        self.restoreContexts(connection.user, timeRestored, callback);
    };

    self.exposed = {
        startContext: self.startContextExposed,
        endContext: self.endContextExposed,
        restoreContexts: self.restoreContextsExposed
    };
}

module.exports = {
    contextCollectionName: contextCollectionName,
    RDataContextController: RDataContextController
};