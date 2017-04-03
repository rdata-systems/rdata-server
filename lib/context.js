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
    self.timeInterrupted = null;
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
        if(connection.authorized && connection.contexts && Array.isArray(connection.contexts))
        {
            // Interrupt open high level contexts
            for (var i = 0, len = connection.contexts.length; i < len; i++) {
                var context = connection.contexts[i];
                if(context.status === contextStatusStarted)
                    self.interruptContextRecursively(connection.user, context);
            }
        }
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
            self.findAndRestoreContext(user, parentContextId, timeStarted, function onContextFound(error, parentContext){
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
                user.connection.contexts.push(context);
                self.addContextStartedEvent(user, context, callback);
            });
        }
    };

    self.endContextRecursively = function(user, context, timeEnded, callback){
        // End this context
        self.db.collection(contextCollectionName).updateOne(
            { userId: user.userId, _id: context._id },
            { "$set": { "status": contextStatusEnded, "timeEnded": timeEnded  } },
            function(err, result) {
                if(err)
                    return callback(err);

                var eventOptions = {
                    name: "EndContextEvent",
                    data: {
                        id: context._id,
                        timeEnded: timeEnded
                    }
                };

                // Log event
                self.server.controllers.eventController.logEvent(user, eventOptions, function(error, result){
                    if(error)
                        return callback(error);

                    self.endChildrenContexts(user, context._id, timeEnded, callback);
                });
            }
        );
    };

    self.endChildrenContexts = function endChildrenContexts(user, parentContextId, timeEnded, callback){
        // Find it's child contexts and end them
        var callbackSeries = [];
        var cursor = self.db.collection(contextCollectionName).find({userId: user.userId, parentContextId: parentContextId, status: {"$in": [contextStatusStarted, contextStatusInterrupted]} });
        cursor.toArray(function(error, result) {
            if (error)
                return callback(error);

            if(result) {
                for (var i = 0; i < result.length; i++) {
                    (function(){
                        var context = result[i];
                        callbackSeries.push(function(cb){
                            self.endContextRecursively(user, context, timeEnded, cb);
                        });
                    })();
                }
                async.series(callbackSeries, callback);
            }
        });
    };

    self.findContext = function findContext(user, contextId, callback){
        self.db.collection(contextCollectionName).find({userId: user.userId, _id: contextId}).limit(1).next(function(err, context) {
            if(err){
                callback(err);
            } else {
                callback(null, context);
            }
        });
    };

    self.findAndRestoreContext = function validateContextExists(user, contextId, timeRestored, callback){
        self.findContext(user, contextId, function(error, context){
            if(error){
                callback(error);
            } else if(context === null || context.status == contextStatusEnded) {
                callback(new exceptions.ContextValidationError());
            } else if(context.status == contextStatusInterrupted){
                // Context status is interrupted and we are performing actions on the context. Restore it
                self.restoreContextRecursively(user, context, timeRestored, function(error){
                    if(error)
                        return callback(error);

                    callback(null, context);
                });
            } else {
                callback(null, context);
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

    self.restoreContextRecursively = function restoreContextRecursively(user, context, timeRestored, callback){
        callback = typeof callback == "function" ? callback : function(){};
        timeRestored = timeRestored || Date.now();

        self.db.collection(contextCollectionName).updateOne(
            { userId: user.userId, _id: context._id},
            { "$set": { "status": contextStatusStarted, "timeRestored": timeRestored } },
            function(err, result) {
                if(err)
                    return callback(err);

                var eventOptions = {
                    name: "RestoreContextEvent",
                    data: {
                        id: context.id,
                        timeRestored: timeRestored
                    }
                };

                // Log event
                self.server.controllers.eventController.logEvent(user, eventOptions, function(error, result){
                    if(error)
                        return callback(error);

                    self.restoreChildrenContexts(user, context._id, timeRestored, callback);
                });
            }
        );
    };

    self.restoreChildrenContexts = function restoreChildrenContexts(user, parentContextId, timeRestored, callback){
        var callbackSeries = [];
        var cursor = self.db.collection(contextCollectionName).find({userId: user.userId, parentContextId: parentContextId, status: contextStatusInterrupted });
        cursor.toArray(function(error, result) {
            if (error)
                return callback(error);

            if(result && Array.isArray(result) && result.length > 0) {
                for (var i = 0; i < result.length; i++) {
                    const context = result[i];
                    callbackSeries.push(function(cb){
                        self.restoreContextRecursively(user, context, timeRestored, cb);
                    });
                }
                async.series(callbackSeries, callback);
            } else {
                callback(null);
            }
        });
    };

    self.interruptContextRecursively = function interruptContextRecursively(user, context, timeInterrupted, callback){
        timeInterrupted = timeInterrupted || Date.now();
        callback = typeof callback == "function" ? callback : function(){};

        self.db.collection(contextCollectionName).updateOne(
            { userId: user.userId, _id: context._id},
            { "$set": { "status": contextStatusInterrupted, "timeInterrupted": timeInterrupted } },
            function(err, result) {
                if(err)
                    callback(err);

                var eventOptions = {
                    name: "InterruptContextEvent",
                    data: {
                        id: context.id,
                        timeInterrupted: timeInterrupted
                    }
                };

                // Log event
                self.server.controllers.eventController.logEvent(user, eventOptions, function(error, result){
                    if(error)
                        return callback(error);

                    self.interruptChildrenContexts(user, context._id, timeInterrupted, callback);
                });
            }
        );
    };

    self.interruptChildrenContexts = function interruptChildrenContexts(user, parentContextId, timeInterrupted, callback){
        var callbackSeries = [];
        var cursor = self.db.collection(contextCollectionName).find({userId: user.userId, parentContextId: parentContextId, status: contextStatusStarted });
        cursor.toArray(function(error, result) {
            if (error)
                return callback(error);

            if(result && Array.isArray(result) && result.length > 0) {
                for (var i = 0; i < result.length; i++) {
                    const context = result[i];
                    callbackSeries.push(function(cb){
                        self.interruptContextRecursively(user, context, timeInterrupted, cb);
                    });
                }
                async.series(callbackSeries, callback);
            } else {
                callback(null)
            }
        });
    };

    self.setContextData = function setContextData(user, context, data, callback){
        callback = typeof callback == "function" ? callback : function(){};

        self.db.collection(contextCollectionName).updateOne(
            { userId: user.userId, _id: context._id },
            { "$set": { data: data } },
            { upsert: false },
            function(err, result){
                if(err)
                    return callback(err);

                var eventOptions = {
                    name: "SetContextDataEvent",
                    contextId: context._id,
                    data: {
                        contextId: context._id,
                        contextData: data
                    }
                };
                self.server.controllers.eventController.logEvent(user, eventOptions, callback);
            }
        );
    };

    self.updateContextDataVariable = function updateContextDataVariable(user, context, key, value, callback){
        callback = typeof callback == "function" ? callback : function(){};
        var updateQuery = {"$set": {}};
        updateQuery["$set"]["data." + key] = value;

        self.db.collection(contextCollectionName).updateOne(
            { userId: user.userId, _id: context._id },
            updateQuery,
            { upsert: false },
            function(err, result){
                if(err)
                    return callback(err);

                var eventOptions = {
                    name: "UpdateContextDataEvent",
                    contextId: context._id,
                    data: {
                        contextId: context._id,
                        key: key,
                        value: value
                    }
                };
                self.server.controllers.eventController.logEvent(user, eventOptions, callback);
            }
        );
    };

    self.getConnectionContext = function getConnectionContext(connection, contextId){
        if(!connection.contexts)
            return null;

        for (var i = 0, len = connection.contexts.length; i < len; i++) {
            var context = connection.contexts[i];
            if(context._id === contextId)
                return context;
        }
        return null;
    };

    self.ensureConnectionHasRootContext = function ensureConnectionHasRootContext(connection, contextId, contextStatus, callback){
        if(!connection.contexts || !Array.isArray(connection.contexts))
            connection.contexts = [];

        var connectionContext = self.getConnectionContext(connection, contextId);
        if(!connectionContext)
        {
            self.findContext(connection.user, contextId, function(error, context) {
                if(error) return callback(error);
                connection.contexts.push(context);
                callback();
            });
        } else {
            connectionContext.status = contextStatus;
            callback();
        }
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

        var timeStarted = params.timeStarted || Date.now();

        // Ensure contexts exist on the connection object
        if(!connection.contexts || !Array.isArray(connection.contexts))
            connection.contexts = [];

        self.startContext(connection.user, params.id, params.name, params.parentContextId, timeStarted, params.data, callback);
    };

    self.endContextExposed = function(connection, params, callback){
        if (!params.id) {
            callback(new errors.InvalidParams("id"));
            return;
        }
        var timeEnded = params.timeEnded || Date.now();

        self.findAndRestoreContext(connection.user, params.id, timeEnded, function onContextValidation(error, context){
            if(error)
                return callback(error);

            if(!context)
                return callback(new errors.InvalidParams("id"));

            // If the context is root context, make sure to end it in the connection object before saving into the database
            if(!context.parentContextId)
            {
                var connectionContext = self.getConnectionContext(connection, context._id);
                if(connectionContext)
                    connectionContext.status = contextStatusEnded;
            }

            self.endContextRecursively(connection.user, context, timeEnded, callback);
        });
    };

    self.restoreContextExposed = function restoreContextExposed(connection, params, callback){
        callback = typeof callback == "function" ? callback : function(){};
        if (!params.id) {
            callback(new errors.InvalidParams("id"));
            return;
        }
        var timeRestored = params.timeRestored || Date.now();

        self.findContext(connection.user, params.id, function(error, context){
            if (error)
                return callback(error);

            if(!context)
                return callback(new errors.InvalidParams("id"));

            self.restoreContextRecursively(connection.user, context, timeRestored, function onContextRestored(err){
                if(err) return callback(err);

                // For the root context, make sure the connection object has it
                if(!context.parentContextId)
                    self.ensureConnectionHasRootContext(connection, context._id, contextStatusStarted, function(err, result){
                        if(err) callback(err);
                        callback(null, true);
                    });
            });
        });
    };

    self.setContextDataExposed = function setContextDataExposed(connection, params, callback){
        callback = typeof callback == "function" ? callback : function(){};
        if (!params.id) {
            callback(new errors.InvalidParams("id"));
            return;
        }
        var data = params.data;
        if (!data)
            data = {};

        var timeSet = params.timeSet || Date.now();

        self.findAndRestoreContext(connection.user, params.id, timeSet, function onContextFoundAndRestored(error, context) {
           if(error)
               return callback(error);

           self.setContextData(connection.user, context, data, callback);
        });
    };

    self.updateContextDataVariableExposed = function updateContextDataExposed(connection, params, callback){
        callback = typeof callback == "function" ? callback : function(){};
        if (!params.id)
            return callback(new errors.InvalidParams("id"));

        if (!params.key)
            return callback(new errors.InvalidParams("key"));

        var value = params.value;
        if(typeof value === 'undefined')
            value = null;

        var timeUpdated = params.timeUpdated || Date.now();

        self.findAndRestoreContext(connection.user, params.id, timeUpdated, function onContextFoundAndRestored(error, context) {
            if(error)
                return callback(error);

            self.updateContextDataVariable(connection.user, context, params.key, value, callback);
        });
    };

    self.exposed = {
        startContext: self.startContextExposed,
        endContext: self.endContextExposed,
        restoreContext: self.restoreContextExposed,

        setContextData: self.setContextDataExposed,
        updateContextDataVariable: self.updateContextDataVariableExposed
    };
}

module.exports = {
    contextCollectionName: contextCollectionName,
    RDataContextController: RDataContextController
};