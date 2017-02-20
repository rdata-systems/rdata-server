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
        var user = new RDataUser(params.userId, connection);
        connection.authenticated = true;
        connection.user = user;
        callback(null, true);
    };

    self.exposedAnonymously = {
        authenticate: self.authenticate
    };
}

module.exports = {
    RDataUserController: RDataUserController
};

