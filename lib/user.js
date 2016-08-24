'use strict';
const JsonRpcErrors = require('./json-rpc').JsonRpcErrors;

const userVariableCollectionName = "userVariable";

function RDataUser(){
    var self = this;
    self.userId = null;
}

function RDataUserVariable(user, key, value){
    var self = this;
    self.userId = user.userId;
    self.key = key;
    self.value = value || null;
}

function RDataUserController(db, eventController){
    var self = this;
    self.db = db;
    self.eventController = eventController;

    self.init = function(callback){
        db.collection(userVariableCollectionName).createIndex(
            {"userId": 1},
            null,
            function(err, result) {
                if(typeof callback === 'function')
                    err ? callback(err, null) : callback(null, result);
            }
        );
        return self;
    };

    self.authenticate = function(user, params, callback){
        user.authenticated = true;
        user.userId = params.userId;
        callback(null, true);
    };

    self.insertVariable = function(user, params, callback){
        var key = params.key;
        var value = params.value || null;
        if(!key){
            callback(new JsonRpcErrors.InvalidParams("key"), null);
            return;
        }
        var userVariable = new RDataUserVariable(user, key, value);
        db.collection(userVariableCollectionName).insertOne(
            userVariable,
            function(err, result){
                if(err) {
                    callback(err);
                } else {
                    var eventOptions = { name: "InsertVariableEvent", data: { key: key, value: value } };
                    self.eventController.logEvent(user, eventOptions, callback);
                }
            }
        );
    };

    self.replaceVariable = function(user, params, callback){
        var key = params.key;
        var filter = params.filter || {};
        var value = params.value || null;
        var options = params.options || {};
        if(!key){ // User can provide either filter or key. If key is provided, filter is built automatically
            callback(new JsonRpcErrors.InvalidParams("key"), null);
            return;
        }
        filter.userId = user.userId;
        filter.key = key;

        var userVariable = new RDataUserVariable(user, key, value);
        db.collection(userVariableCollectionName).replaceOne(
            filter,
            userVariable,
            { upsert: Boolean(options.upsert) },
            function(err, result){
                if(err) {
                    callback(err);
                } else {
                    var eventOptions = { name: "ReplaceVariableEvent", data: { key: key, filter: filter, value: value, options: options } };
                    self.eventController.logEvent(user, eventOptions, callback);
                }
            }
        );
    };

    self.updateVariable = function(user, params, callback) {
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
        filter.userId = user.userId;
        if(key) {
            filter.key = key;
            update.key = key;
        }
        update.userId = user.userId;
        if(value)
            update.value = value;
        db.collection(userVariableCollectionName).updateOne(
            filter,
            update,
            { upsert: Boolean(options.upsert) },
            function(err, result){
                if(err) {
                    callback(err);
                } else {
                    var eventOptions = { name: "UpdateVariableEvent", data: { key: key, filter: filter, update: update, options: options } };
                    self.eventController.logEvent(user, eventOptions, callback);
                }
            }
        );
    };
}

module.exports = {
    userVariableCollectionName: userVariableCollectionName,
    RDataUserController: RDataUserController,
};

