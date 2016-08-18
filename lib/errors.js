const util = require('util');

/**
 *  JsonRpc errors - sent to the client
 */

var JsonRpcErrors = {
    // -32768 to -32000 are reserved for JsonRpc errors
    NonAuthenticated: function(){
        this.message = 'Non-authenticated';
        this.code = -31000;
    },
    AuthenticationError: function(){
        this.message = 'Authentication error';
        this.code = -31001;
    },
    NotificationsNotSupported: function(){
        this.message = 'Notifications not supported';  // Notifications are not supported by RDataServer
        this.code = -31002;
    }
};

// Server exceptions
var Exceptions = {
    CommandError: function(message, extra) {
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;
        this.message = message;
        this.extra = extra;
    }
};

for(var exception in Exceptions){
    require('util').inherits(Exceptions[exception], Error);
}

module.exports = {
    'JsonRpcErrors': JsonRpcErrors,
    'Exceptions': Exceptions
};
