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

function RDataUserController(db){
    var self = this;
    self.db = db;

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
                if(err)
                    callback(err);
                else
                    callback(null, true);
            }
        );
    };

    self.replaceVariable = function(user, params, callback){
        var key = params.key;
        var filter = params.filter;
        var value = params.value || null;
        var options = params.options;
        if(!key){
            callback(new JsonRpcErrors.InvalidParams("key"), null);
            return;
        }
        if(!filter){
            callback(new JsonRpcErrors.InvalidParams("filter"), null);
            return;
        }
        filter.userId = user.userId;
        filter.key = key;
        var userVariable = new RDataUserVariable(user, key, value);
        db.collection(userVariableCollectionName).replaceOne(
            filter,
            userVariable,
            { upsert: options && typeof options.upsert === "boolean" ? options.upsert : true },
            function(err, result){
                if(err)
                    resultCallback(err);
                else
                    resultCallback(null, true);
            }
        );
    };

    self.updateVariable = function(user, params, callback) {
        var key = params.key;
        var filter = params.filter;
        var update = params.update;
        var options = params.options;
        if(!key){
            callback(new JsonRpcErrors.InvalidParams("key"), null);
            return;
        }
        if(!filter){
            callback(new JsonRpcErrors.InvalidParams("filter"), null);
            return;
        }
        if(!update){
            callback(new JsonRpcErrors.InvalidParams("update"), null);
            return;
        }
        filter.userId = user.userId;
        filter.key = key;
        db.collection(userVariableCollectionName).updateOne(
            filter,
            update,
            { upsert: options && typeof options.upsert === "boolean" ? options.upsert : true },
            function(err, result){
                if(err)
                    callback(err);
                else
                    callback(null, true);
            }
        );
    };
};

module.exports = {
    RDataUserController: RDataUserController,
};

