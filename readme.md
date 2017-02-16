# RData - Data Collection Instrument

Based on WebSockets, Json-RPC 2.0 and MongoDB

[![Build Status](https://travis-ci.org/rdata-systems/rdata-server.svg?branch=master)](https://travis-ci.org/rdata-systems/rdata-server)

## Warning
This software is currently in it's beta stage. The newest versions might (and most likely will) break the backwards compatibility.

## Basic usage
```javascript
var RDataServer = require('rdata-server');

var server = new RDataServer({
    host: '0.0.0.0',
    port: 8888,
    dbUrl: 'mongodb://localhost:27017/data',
});
server.runServer();
```
RDataServer options:
- **host** - Server host
- **Port** - Server port
- **dbUrl** - Connection url of the MongoDB
- **exposed** - dictionary with exposed methods. Contains methodName and method. See: [Extending the functionality](https://github.com/rdata-systems/rdata-server/wiki/5.-Extending-the-functionality)
- **exposedAnonymously** - dictionary with anonymously exposed methods. See: [Extending the functionality](https://github.com/rdata-systems/rdata-server/wiki/5.-Extending-the-functionality)
- **controllers** - dictionary with custom controllers. See: [Extending the functionality](https://github.com/rdata-systems/rdata-server/wiki/5.-Extending-the-functionality)

The package includes standard server.js bootstrap script that you can use.

## Wiki index:
- [Json-RPC protocol](https://github.com/rdata-systems/rdata-server/wiki/0.-Json-RPC-protocol)
- [Authentication](https://github.com/rdata-systems/rdata-server/wiki/1.-Authentication)
- [Events](https://github.com/rdata-systems/rdata-server/wiki/2.-Events)
- [Contexts](https://github.com/rdata-systems/rdata-server/wiki/3.-Contexts)
- [User Variables](https://github.com/rdata-systems/rdata-server/wiki/4.-User-Variables)
- [Batch and Bulk requests](https://github.com/rdata-systems/rdata-server/wiki/5.-Batch-and-Bulk-requests)
- [Extending the functionality](https://github.com/rdata-systems/rdata-server/wiki/6.-Extending-the-functionality)

## Examples
For more examples, see [**test**](https://github.com/rdata-systems/rdata-server/tree/master/test) folder.
