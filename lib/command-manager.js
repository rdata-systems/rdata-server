/**
 * Command manager
 * Responsible for registering and handling commands from client
 */
function RDataCommandManager(){

    var self = this;

    self.commands = {};

    self.get = function(command){
        return self.commands[command];
    };

    self.set = function(command, method){
        self.commands[command] = method;
    };

    self.has = function(command){
        return command in self.commands;
    };

    self.execute = function(db, client, command, params, callback){
        self.commands[command](db, client, params, callback);
    };

}

module.exports = RDataCommandManager;