'use strict';
const JsonRpcErrors = require('./json-rpc').JsonRpcErrors;

const userVariableCollectionName = "userVariable";

function RDataUser(userId){
    var self = this;
    self.userId = userId;
}

function RDataUserVariable(user, key, value){
    var self = this;
    self.userId = user.userId;
    self.key = key;
    self.value = value || null;
}

function RDataUserController(server){

    if (this instanceof RDataUserController === false) {
        return new RDataUserController(server);
    }

    var self = this;
    self.server = server;
    self.db = server.db;

    self.init = function(callback){
        self.db.collection(userVariableCollectionName).createIndex(
            {"userId": 1}, // 1 means descending order
            null,
            function(err, result) {
                if(typeof callback === 'function')
                    err ? callback(err, null) : callback(null, result);
            }
        );
        return self;
    };

    self.authenticate = function(connection, params, callback){
        var user = new RDataUser(params.userId);
        connection.authenticated = true;
        connection.user = user;
        callback(null, true);
    };

    self.insertVariable = function(connection, params, callback){
        var key = params.key;
        var value = params.value || null;
        if(!key){
            callback(new JsonRpcErrors.InvalidParams("key"), null);
            return;
        }
        var userVariable = new RDataUserVariable(connection.user, key, value);
        self.db.collection(userVariableCollectionName).insertOne(
            userVariable,
            function(err, result){
                if(err) {
                    callback(err);
                } else {
                    var eventOptions = { name: "InsertVariableEvent", data: { key: key, value: value } };
                    self.server.controllers.eventController.logEvent(connection.user, eventOptions, callback);
                }
            }
        );
    };

    self.replaceVariable = function(connection, params, callback){
        var key = params.key;
        var filter = params.filter || {};
        var value = params.value || null;
        var options = params.options || {};
        if(!key){ // User can provide either filter or key. If key is provided, filter is built automatically
            callback(new JsonRpcErrors.InvalidParams("key"), null);
            return;
        }
        filter.userId = connection.user.userId;
        filter.key = key;

        var userVariable = new RDataUserVariable(connection.user, key, value);
        self.db.collection(userVariableCollectionName).replaceOne(
            filter,
            userVariable,
            { upsert: Boolean(options.upsert) },
            function(err, result){
                if(err) {
                    callback(err);
                } else {
                    var eventOptions = { name: "ReplaceVariableEvent", data: { key: key, filter: filter, value: value, options: options } };
                    self.server.controllers.eventController.logEvent(connection.user, eventOptions, callback);
                }
            }
        );
    };

    self.updateVariable = function(connection, params, callback) {
        var key = params.key;
        var value = params.value;
        var filter = params.filter || {};
        var update = params.update || {};
        var options = params.options || {};
        if(!key && filter == {}){ // User can provide either filter or key. If key is provided, filter is built automatically
            callback(new JsonRpcErrors.InvalidParams("key || filter"), null);
            return;
        }
        if(!update && !value){
            callback(new JsonRpcErrors.InvalidParams("update || value"), null);
            return;
        }
        filter.userId = connection.user.userId;
        if(key) {
            filter.key = key;
            update.key = key;
        }
        update.userId = connection.user.userId;
        if(value)
            update.value = value;
        self.db.collection(userVariableCollectionName).updateOne(
            filter,
            update,
            { upsert: Boolean(options.upsert) },
            function(err, result){
                if(err) {
                    callback(err);
                } else {
                    var eventOptions = { name: "UpdateVariableEvent", data: { key: key, filter: filter, update: update, options: options } };
                    self.server.controllers.eventController.logEvent(connection.user, eventOptions, callback);
                }
            }
        );
    };

    self.exposedAnonymously = {
        authenticate: self.authenticate
    };

    self.exposed = {
        insertVariable: self.insertVariable,
        replaceVariable: self.replaceVariable,
        updateVariable: self.updateVariable
    };
}

module.exports = {
    userVariableCollectionName: userVariableCollectionName,
    RDataUserController: RDataUserController
};

