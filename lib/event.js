'use strict';

/**
 * Client event.
 * Simply logs events into the MongoDB table
 */

const eventCollectionName = 'events';

/**
 * Basic RDataEvent structure
 * @param user
 * @param name
 * @param time
 * @param data
 * @constructor
 */
function RDataEvent(user, name, time, data){
    var self = this;
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

    self.initDb = function(callback){
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
        var event = new RDataEvent(connection.user, params.name, params.time || Date.now(), params.data);
        self.db.collection(eventCollectionName).insertOne(event, function(err, result) {
            if(err)
                resultCallback(err);
            else
                resultCallback(null, true);
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