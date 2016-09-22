# RData - Data Collection Instrument

Based on WebSockets, Json-RPC 2.0 and MongoDB

[![Build Status](https://travis-ci.org/rdata-systems/rdata-server.svg?branch=master)](https://travis-ci.org/rdata-systems/rdata-server)

## Basic usage
~~~~ 
var RDataServer = require('rdata-server');

var server = new RDataServer({
    host: '0.0.0.0',
    port: 8888,
    dbUrl: 'mongodb://localhost:27017/data',
});
server.runServer();
~~~~ 
RDataServer options:
- **host** - Server host
- **Port** - Server port
- **dbUrl** - Connection url of the MongoDB
- **exposed** - dictionary with exposed methods. Contains methodName and method. See: exposing new methods
- **exposedAnonymously** - dictionary with anonymously exposed methods. See: exposing new methods
- **controllers** - dictionary with custom controllers. See: exposing custom controllers

The package includes standard server.js bootstrap script that you can use.

## Wiki index:
- [Json-RPC server implementation](https://github.com/rdata-systems/rdata-server/wiki/Json-RPC-over-Websockets-server-implementation)
- [Authentication](https://github.com/rdata-systems/rdata-server/wiki/Authentication)
- [Events](https://github.com/rdata-systems/rdata-server/wiki/Events)
- [Contexts](https://github.com/rdata-systems/rdata-server/wiki/Contexts)
- [User Variables](https://github.com/rdata-systems/rdata-server/wiki/User-Variables)
- [Extending the functionality](https://github.com/rdata-systems/rdata-server/wiki/Extending-the-functionality)
