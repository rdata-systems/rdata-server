'use strict';

const errors = require('./json-rpc').JsonRpcErrors;
const Guid = require('guid');

/**
 * Client event.
 * Simply logs events into the MongoDB table
 */

const eventCollectionName = 'events';

/**
 * Basic RDataEvent structure
 * @param user
 * @param id
 * @param name
 * @param time
 * @param data
 * @constructor
 */
function RDataEvent(user, id, name, time, data){
    var self = this;
    self._id = id;
    self.time = time;
    self.name = name;
    self.data = data;
    self.userId = user.userId;
}

function RDataEventController(server){

    if (this instanceof RDataEventController === false) {
        return new RDataEventController(server);
    }

    var self = this;
    self.server = server;
    self.db = server.db;

    self.init = function(callback){
        self.db.collection(eventCollectionName).createIndex(
            {"userId": 1},
            null,
            function(err, result) {
                if(typeof callback === 'function')
                    err ? callback(err, null) : callback(null, result);
            }
        );
        return self;
    };

    self.logEvent = function(connection, params, resultCallback){
        if (!params.name) {
            resultCallback(new errors.InvalidParams("name"));
            return;
        }

        var event = new RDataEvent(connection.user, params.id || Guid.raw(), params.name, params.time || Date.now(), params.data);

        // Check if the event with that id already exists
        self.db.collection(eventCollectionName).find({userId: connection.user.userId, _id: event._id }).count(function(error, count){
            if (error) {
                resultCallback(error);
            } else {
                if (count > 0) {
                    resultCallback(null, false); // This event has already been logged
                } else {
                    self.db.collection(eventCollectionName).insertOne(event, function (err, result) {
                        if (err)
                            resultCallback(err);
                        else
                            resultCallback(null, true);
                    });
                }
            }
        });
    };

    self.exposed = {
        logEvent: self.logEvent,
    };

}

module.exports = {
    eventCollectionName: eventCollectionName,
    RDataEventController: RDataEventController
};