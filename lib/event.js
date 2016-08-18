/**
 * Client event.
 * Simply logs event into the mongo table
 */

function RDataEvent(client, data){

    var self = this;

    self.timeReceived = Date.now;
    self.data = data;
    self.clientId = client.clientId;
}

var commands = {
    logEvent: function(client, params){
        var event = new RDataEvent(client, params.data);
        console.log("Log client event: " + event);
    }
};

module.exports = {
    // JsonRpc protocol
    'RDataEvent': RDataEvent,
    'commands': commands
};

