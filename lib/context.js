'use strict';

const async = require('async');
const errors = require('./json-rpc').JsonRpcErrors;

/**
 * Client context.
 * Context can be persistent and might have parent context.
 * If the context is not persistent (default), it will not be closed when the client is disconnected
 * If the context has child contexts, they will be closed when the parent context is closed
 */

const contextCollectionName = 'contexts';

/**
 * Basic RDataContext structure
 * @param user
 * @param id
 * @param name
 * @param persistent
 * @param parentContextId
 * @param timeStarted
 * @param data
 * @param status
 * @constructor
 */
function RDataContext(user, id, name, persistent, parentContextId, timeStarted, data, status){
    var self = this;
    self.id = id;
    self.name = name;
    self.persistent = Boolean(persistent);
    self.status = status || "started";
    self.parentContextId = parentContextId || null;
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

    // When user is disconnected from server, end user non-persistent contexts
    server.on('user disconnected', function(connection){
        if(connection.authenticated)
            self.endUserContexts(connection, Date.now(), true);
    });

    self.initDb = function(callback){
        self.db.collection(contextCollectionName).createIndex(
            {"userId": 1},
            null,
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
            { userId: connection.user.userId, id: id },
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
                                const contextId = context.id;
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

    self.startContext = function(connection, params, callback) {
        if (!params.id) {
            callback(new errors.InvalidParams("id"));
            return;
        }
        if (!params.name) {
            callback(new errors.InvalidParams("name"));
            return;
        }

        var context = new RDataContext(connection.user, params.id, params.name, params.persistent, params.parentContextId, params.timeStarted, params.data);
        self.db.collection(contextCollectionName).insertOne(context, function(err, result) {
            if(err) {
                callback(err);
            } else {
                var eventOptions = {
                    name: "StartContextEvent",
                    data: {
                        id: context.id,
                        name: context.name,
                        persistent: context.persistent,
                        parentContextId: context.parentContextId,
                        timeStarted: context.timeStarted,
                        timeEnded: context.timeEnded,
                        data: context.data,
                    }
                };
                self.server.controllers.eventController.logEvent(connection, eventOptions, callback);
            }
        });
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

    self.endUserContexts = function(connection, timeEnded, skipPersistent, callback){
        callback = typeof callback == "function" ? callback : function(){};
        timeEnded = timeEnded || Date.now();
        skipPersistent = typeof skipPersistent == "undefined" ? skipPersistent : true;

        var updateFilter = { userId: connection.user.userId, status: "started",  };
        if(skipPersistent)
            updateFilter.persistent = false;

        self.db.collection(contextCollectionName).updateMany(
            updateFilter,
            { "$set": { "status": "ended", "timeEnded": timeEnded  } },
            function(err, result) {
                if(err) {
                    callback(err);
                } else {
                    var eventOptions = {
                        name: "EndUserContextsEvent",
                        data: {
                            timeEnded: timeEnded,
                        }
                    };
                    self.server.controllers.eventController.logEvent(connection, eventOptions, callback);
                }
            }
        );
    };

    self.restoreContext = function(connection, params, callback){
        if (!params.id) {
            callback(new errors.InvalidParams("id"));
            return;
        }

        self.db.collection(contextCollectionName).updateOne(
            { userId: connection.user.userId, id: params.id },
            { "$set": { "status": "started", "timeEnded": null } },
            function(err, result) {
                if(err) {
                    callback(err);
                } else {
                    var eventOptions = {
                        name: "RestoreContextEvent",
                        data: {
                            id: params.id
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
        restoreContext: self.restoreContext
    };
}

module.exports = {
    contextCollectionName: contextCollectionName,
    RDataContextController: RDataContextController
};