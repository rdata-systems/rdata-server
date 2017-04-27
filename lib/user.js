'use strict';
const JsonRpcErrors = require('./json-rpc').JsonRpcErrors;

function RDataUser(userId, userPayload, connection){
    var self = this;
    self.userId = userId;
    self.userPayload = userPayload;
    self.connection = connection;
}

function RDataUserController(server){

    if (this instanceof RDataUserController === false) {
        return new RDataUserController(server);
    }

    var self = this;
    self.server = server;
    self.db = server.db;

    self.authorize = function(connection, params, callback){
        connection.authorize(params.userId, params.gameVersion, params.userPayload || null, function (err) {
            if (err) return callback(err);
            callback(null, true);
        });
    };

    self.exposedAnonymously = {
        authorize: self.authorize
    };
}

module.exports = {
    RDataUser: RDataUser,
    RDataUserController: RDataUserController
};

