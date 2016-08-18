/**
 * Client event.
 * Simply logs event into the mongo table
 */

const collectionName = 'event';

function RDataEvent(client, data){

    var self = this;

    self.timeReceived = Date.now;
    self.data = data;
    self.userId = client.userId;
}

/**
 * Inits the database for Events
 * @param {} db
 * @param callback
 */
var initDb = function(db, callback){
    db.collection(collectionName).createIndex(
        {"userId": 1},
        null,
        function(err, results) {
            if(callback)
                callback();
        }
    );
};

var commands = {
    logEvent: function(db, client, params, callback){
        var event = new RDataEvent(client, params.data);
        db.collection(collectionName).insertOne(event);
        callback(true);
    }
};

module.exports = {
    'collectionName': collectionName,
    'commands': commands,
    'RDataEvent': RDataEvent,
    'initDb': initDb
};

