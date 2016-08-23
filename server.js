var RDataServer = require('./lib/server.js');

var server = new RDataServer({
    host: '0.0.0.0',
    port: 8888,
    dbUrl: 'mongodb://localhost:27017/data',
});
server.runServer();
