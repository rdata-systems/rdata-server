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

    self.checkEventExists = function checkEventExists(user, eventId, resultCallback){
        self.db.collection(eventCollectionName).find({_id: eventId }).count(function(error, count){
            if(error)
                return resultCallback(error);

            return resultCallback(null, count > 0);
        });
    };

    self.insertEvent = function insertEvent(user, event, callback){
        // Check if the event with that id already exists
        self.checkEventExists(user, event._id, function(error, eventExists) {
            if (error)
                return callback(error);

            if (eventExists)
                return callback(null, false); // This event has already been logged

            self.db.collection(eventCollectionName).insertOne(event, function (err, result) {
                if (err)
                    callback(err);
                else
                    callback(null, true);
            });
        });
    };

    self.logEvent = function(user, eventOptions, callback){
        var event = new RDataEvent(user, eventOptions.id || Guid.raw(), eventOptions.name, eventOptions.time || Date.now(), eventOptions.contextId || null, eventOptions.data);

        if(event.contextId){ // If context id is provided, validate and restore this context first
            self.server.controllers.contextController.validateAndRestoreContext(user, event.contextId, event.time, function(error, result){
                if(error)
                    return callback(error);
                else if(result === false)
                    return callback(null, result);
                else
                    return self.insertEvent(user, event, callback); // Context is valid. Insert the event
            });
        } else { // No context - simply insert the event
            return self.insertEvent(user, event, callback);
        }
    };

    self.logEventExposed = function logEventExposed(connection, params, resultCallback){
        if (!params.name) {
            resultCallback(new errors.InvalidParams("name"));
            return;
        }
        return self.logEvent(connection.user, params, resultCallback);
    };

    self.exposed = {
        logEvent: self.logEventExposed
    };

}

module.exports = {
    eventCollectionName: eventCollectionName,
    RDataEventController: RDataEventController
};