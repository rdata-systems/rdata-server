'use strict';

/**
 * Client event.
 * Simply logs events into the MongoDB table
 */

const eventCollectionName = 'events';

/**
 * Basic RDataEvent structure
 * @param {RDataUser} user
 * @param data
 * @constructor
 */
function RDataEvent(user, name, data){
    var self = this;
    self.timeReceived = Date.now;
    self.name = name;
    self.data = data;
    self.userId = user.userId;
}

function RDataEventController(db){
    var self = this;
    self.db = db;

    self.init = function(callback){
        db.collection(eventCollectionName).createIndex(
            {"userId": 1},
            null,
            function(err, result) {
                if(typeof callback === 'function')
                    err ? callback(err, null) : callback(null, result);
            }
        );
        return self;
    };

    // Methods that will be exposed
    self.logEvent = function(user, params, resultCallback){
        var event = new RDataEvent(user, params.name, params.data);
        db.collection(eventCollectionName).insertOne(event, function(err, result) {
            if(err)
                resultCallback(err);
            else
                resultCallback(null, true);
        });
    };

}

module.exports = {
    eventCollectionName: eventCollectionName,
    RDataEventController: RDataEventController
};