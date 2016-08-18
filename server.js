var RDataServer = require('./lib/rdata-server.js');

var server = new RDataServer({ host: '0.0.0.0', port: 8080 });
server.runServer();
