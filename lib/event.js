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
 * @param contextId
 * @param data
 * @constructor
 */
function RDataEvent(user, id, name, time, contextId, data){
    var self = this;
    self._id = id;
    self.time = time;
    self.name = name;
    self.contextId = contextId;
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
        self.db.collection(eventCollectionName).createIndexes(
            [{"key": {"userId": 1}}, {"key": {"contextId": 1}}],
            function(err, result) {
                if(typeof callback === 'function')
                    err ? callback(err, null) : callback(null, result);
            }
        );
        return self;
    };

    self.logEvent = function(user, eventOptions, callback){
        var event = new RDataEvent(user, eventOptions.id || Guid.raw(), eventOptions.name, eventOptions.time || Date.now(), eventOptions.contextId || null, eventOptions.data);

        // Check if the event with that id already exists
        self.db.collection(eventCollectionName).find({_id: event._id }).count(function(error, count){
            if (error) {
                callback(error);
            } else {
                if (count > 0) {
                    callback(null, false); // This event has already been logged
                } else {
                    self.db.collection(eventCollectionName).insertOne(event, function (err, result) {
                        if (err)
                            callback(err);
                        else
                            callback(null, true);
                    });
                }
            }
        });
    };

    self.logEventExposed = function logEventExposed(connection, params, resultCallback){
        if (!params.name) {
            resultCallback(new errors.InvalidParams("name"));
            return;
        }
        return self.logEvent(connection.user, params, resultCallback);
    };

    self.exposed = {
        logEvent: self.logEvent
    };

}

module.exports = {
    eventCollectionName: eventCollectionName,
    RDataEventController: RDataEventController
};