'use strict';

const JsonRpc = require('./json-rpc');
const errors = JsonRpc.JsonRpcErrors;
const async = require('async');

/**
 * Bulk request controller.
 * Exposes a special method that lets you
 * send multiple requests in one in the silent mode.
 * Unlike json-rpc "batch request", this "bulk request"
 * is made for one-sided data logging only, since it
 * wont send you all responses. Instead, it sends you
 * one notification that bulk request was successfully executed.
 */

function RDataBulkRequestController(server){

    if (this instanceof RDataBulkRequestController === false) {
        return new RDataBulkRequestController(server);
    }

    var self = this;
    self.server = server;

    self.bulkRequest = function(connection, params, resultCallback){
        if (!params.requests || !Array.isArray(params.requests)) {
            resultCallback(new errors.InvalidParams("requests"));
            return;
        }

        // Execute all requests in parallel using async
        var tasks = []; // Build tasks array with functions that will be called in async.parallel
        params.requests.forEach(function(r){
            tasks.push(function(callback){
                try {
                    var request = new JsonRpc.JsonRpcRequest(r);
                } catch (err) { // One of the requests in the bulk is invalid. Call async callback with error
                    callback(new JsonRpc.JsonRpcErrors.InvalidRequest());
                    return;
                }

                if(request.method == 'bulkRequest'){ // Bulk request must not contain another bulk request in it. Ignore this request.
                    callback(new JsonRpc.JsonRpcErrors.InvalidRequest());
                    return;
                }

                self.server.processRequest(connection, request, function(error, response){
                    if(response.error)
                        callback(response.error, null);
                    else
                        callback(error, response);
                });
            });
        });
        async.series(tasks, function(error, responses){
            if(error){
                resultCallback(error);
            } else {
                resultCallback(null, true); // If all responses were successfully executed return with result: true
            }
        });
    };

    self.exposed = {
        bulkRequest: self.bulkRequest,
    };

}

module.exports = {
    RDataBulkRequestController: RDataBulkRequestController
};