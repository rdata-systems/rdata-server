const assert = require('assert');
const WebSocket = require('ws');
const jsonRpcVersion = "2.0";
const port = 8899;

module.exports = {
    jsonRpcVersion: jsonRpcVersion,
    port: port,

    /**
     * Connects to the server and authenticates using default authentication.
     * After that, returns callback
     * @param {function} callback
     */
    connectAndAuthenticate: function (callback) {
        var authRequest = JSON.stringify({
            "jsonrpc": jsonRpcVersion,
            "method": "authenticate",
            "params": {userId: "test"},
            "id": 1
        });
        var ws = new WebSocket('ws://localhost:' + port);
        ws.on('open', function open() {
            ws.send(authRequest);
        });
        var onMessage = function (data, flags) {
            var answer = JSON.parse(data);
            assert(answer.result);
            ws.removeListener('message', onMessage);
            callback(ws);
        };
        ws.on('message', onMessage);
    },
};