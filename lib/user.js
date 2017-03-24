'use strict';
const JsonRpcErrors = require('./json-rpc').JsonRpcErrors;

function RDataUser(userId, connection){
    var self = this;
    self.userId = userId;
    self.connection = connection;
}

function RDataUserController(server){

    if (this instanceof RDataUserController === false) {
        return new RDataUserController(server);
    }

    var self = this;
    self.server = server;
    self.db = server.db;

    self.authenticate = function(connection, params, callback){
        connection.authenticate(params.userId, function(err){
           if(err) return callback(err);
           callback(null, true);
        });
    };

    self.exposedAnonymously = {
        authenticate: self.authenticate
    };
}

module.exports = {
    RDataUser: RDataUser,
    RDataUserController: RDataUserController
};

