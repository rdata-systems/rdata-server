const JsonRpc = require('../lib/json-rpc');
const assert = require('assert');

const jsonRpcVersion = "2.0";

describe('JsonRpc', function() {
    describe('JsonRpcRequest', function() {
        it('creates valid request object', function () {
            var id = 1;
            var request = new JsonRpc.JsonRpcRequest({
                "jsonrpc": jsonRpcVersion,
                "method": "test",
                "params": {"a": "b"},
                "id": id
            });
            assert.equal(request.id, id);
        });

        it('throws exception when creating request without valid json rpc version', function () {
            assert.throws(function(){
                var request = new JsonRpc.JsonRpcRequest({
                    "jsonrpc": "1.0",
                    "method": "test",
                    "params": {"a": "b"},
                    "id": 1
                });
            }, JsonRpc.JsonRpcErrors.JsonRpcException);
        });

        it('throws exception when creating request without method', function () {
            assert.throws(function(){
                var request = new JsonRpc.JsonRpcRequest({
                    "jsonrpc": "2.0",
                    "params": {"a": "b"},
                    "id": 1
                });
            }, JsonRpc.JsonRpcErrors.JsonRpcException);
        });

        it('throws exception when creating request with method == null', function () {
            assert.throws(function(){
                var request = new JsonRpc.JsonRpcRequest({
                    "jsonrpc": "2.0",
                    "method": null,
                    "params": {"a": "b"},
                    "id": 1
                });
            }, JsonRpc.JsonRpcErrors.JsonRpcException);
        });

        it('creates request with no params', function () {
            var id = 1;
            var request = new JsonRpc.JsonRpcRequest({
                "jsonrpc": "2.0",
                "method": "test",
                "id": id
            });
            assert.equal(request.id, id);
        });

        it('creates request with object params', function () {
            var params = {"a": "b"};
            var request = new JsonRpc.JsonRpcRequest({
                "jsonrpc": "2.0",
                "method": "test",
                "params": params,
                "id": 1
            });
            assert.equal(request.params["a"], params["a"]);
        });

        it('creates request with array params', function () {
            var params = [1,2,3];
            var request = new JsonRpc.JsonRpcRequest({
                "jsonrpc": "2.0",
                "method": "test",
                "params": params,
                "id": 1
            });
            assert.equal(request.params[0], params[0]);
        });

        it('throws exception when creating request with non-structured params', function () {
            assert.throws(function(){
                var request = new JsonRpc.JsonRpcRequest({
                    "jsonrpc": "2.0",
                    "method": "test",
                    "params": "non-structured params",
                    "id": 1
                });
            }, JsonRpc.JsonRpcErrors.JsonRpcException);
        });

        it('throws exception when creating request with non-primitive id', function () {
            assert.throws(function(){
                var request = new JsonRpc.JsonRpcRequest({
                    "jsonrpc": "2.0",
                    "method": "test",
                    "params": {"a": "b"},
                    "id": {"non-primitive id": 123}
                });
            }, JsonRpc.JsonRpcErrors.JsonRpcException);
        });

        it('creates request with numeric id', function () {
            var request = new JsonRpc.JsonRpcRequest({
                "jsonrpc": "2.0",
                "method": "test",
                "params": {"a": "b"},
                "id": 1
            });
            assert(!request.isNotification);
        });

        it('creates request with string id', function () {
            var request = new JsonRpc.JsonRpcRequest({
                "jsonrpc": "2.0",
                "method": "test",
                "params": {"a": "b"},
                "id": "idtoken123"
            });
            assert.equal(request.id, "idtoken123");
            assert(!request.isNotification);
        });

        it('creates request with id == null', function () {
            var request = new JsonRpc.JsonRpcRequest({
                "jsonrpc": "2.0",
                "method": "test",
                "params": {"a": "b"},
                "id": null
            });
            assert.equal(request.id, null);
            assert(!request.isNotification);
        });

        it('creates notification when id is not presented', function () {
            var request = new JsonRpc.JsonRpcRequest({
                "jsonrpc": "2.0",
                "method": "test",
                "params": {"a": "b"}
            });
            assert(request.isNotification);
        });
    });

    describe('JsonRpcResponse', function(){

        it('creates valid response object', function () {
            var id = 1;
            var response = new JsonRpc.JsonRpcResponse({
                "result": "test",
                "id": id
            });
            assert.equal(response.id, id);
        });

        it('creates valid response object with jsonrpc == "2.0"', function () {

            var response = new JsonRpc.JsonRpcResponse({
                "result": "test",
                "id": 1
            });
            assert.equal(response.jsonrpc, jsonRpcVersion);
        });

        it('creates valid response with result == null', function () {
            var response = new JsonRpc.JsonRpcResponse({
                "result": null,
                "id": 1
            });
            assert.equal(response.result, null);
        });

        it('throws exception when creating response with no result or error', function () {
            assert.throws(function(){
                var response = new JsonRpc.JsonRpcResponse({
                    "id": 1
                });
            }, JsonRpc.JsonRpcErrors.JsonRpcException);
        });

        it('creates valid response with error', function () {
            var response = new JsonRpc.JsonRpcResponse({
                "error": new JsonRpc.JsonRpcErrors.InternalError(),
                "id": 1
            });
            assert.equal(response.error.code, (new JsonRpc.JsonRpcErrors.InternalError()).code);
        });

        it('throws exception when creating response with non-primitive id', function () {
            assert.throws(function(){
                var response = new JsonRpc.JsonRpcResponse({
                    "result": "test",
                    "id": {"non-primitive id": 123}
                });
            }, JsonRpc.JsonRpcErrors.JsonRpcException);
        });

        it('creates response with numeric id', function () {
            var response = new JsonRpc.JsonRpcResponse({
                "result": "test",
                "id": 1
            });
            assert(response.id, 1);
        });

        it('creates response with string id', function () {
            var response = new JsonRpc.JsonRpcResponse({
                "result": "test",
                "id": "idtoken123"
            });
            assert.equal(response.id, "idtoken123");
        });

        it('creates response with id == null', function () {
            var response = new JsonRpc.JsonRpcResponse({
                "result": "test",
                "id": null
            });
            assert.equal(response.id, null);
        });

    });
});