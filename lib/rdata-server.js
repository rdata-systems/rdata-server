/**
 *  RDataServer: Data Collection Server based on websockets
 */

'use strict';

const util = require('util');
const events = require('events');
const EventEmitter = events.EventEmitter;
const ws = require('ws');
const MongoClient = require('mongodb').MongoClient;
const JsonRpc = require('./json-rpc');
const errors = require('./errors');
const CommandManager = require('./command-manager');

const client = require('./client');
const Client = client.RDataClient;
const event = require('./event');
const Event = event.RDataEvent;

function RDataServer(options){

    var self = this;

    // Server as EventEmitter
    EventEmitter.call(this);

    // Options
    options = Object.assign({
        port: 80,
        host: '0.0.0.0',
        dbUrl: 'mongodb://localhost:27017/data',
        commands: {},
        anonymousCommands: {}
    }, options);

    /**
     * Inits the MongoDB
     */
    self.initDb = function(){
        MongoClient.connect(self.options.dbUrl, function(err, db) {
            if(err) {
                self.emit('error', err);
            } else {
                self.db = db;
                self.emit('db ready', db);
            }
        });
    };

    /**
     * Init EventEmitter events
     */
    self.initServerEvents = function(){

        self.on('db ready', function(db){
            // Prepare database to run for different modules
            event.initDb(db);
        });

        self.on('client connected', function(client){
            // Accepted connection from client...
        });

        self.on('request', function(client, request){
            var command = request.method;
            var params = request.params;
            var requestId = request.id || null;

            if(request.isNotification){
                client.send(new JsonRpc.JsonRpcResponse({
                    error: new errors.JsonRpcErrors.NotificationsNotSupported(),
                    id: requestId
                }));
            }

            if(!self.anonymousCommands.has(command) && !client.authenticated){
                client.send(new JsonRpc.JsonRpcResponse({
                    error: new errors.JsonRpcErrors.NonAuthenticated(),
                    id: requestId
                }));
            } else {
                var commandManager;
                if(self.commands.has(command)) {
                    commandManager = self.commands;
                } else if(self.anonymousCommands.has(command)) {
                    commandManager = self.anonymousCommands;
                } else {
                    client.send(new JsonRpc.JsonRpcResponse({
                        error: new JsonRpc.JsonRpcErrors.MethodNotFound(),
                        id: requestId
                    }));
                    return;
                }

                // Execute the command
                try {
                    self.emit('client command ' + command);
                    commandManager.execute(self.db, client, command, params, function callback(result) {
                        // Send result
                        client.send(new JsonRpc.JsonRpcResponse({
                            result: result || null,
                            id: requestId
                        }));
                    });

                } catch (err) {
                    console.error(err.stack);
                    client.send(new JsonRpc.JsonRpcResponse({
                        error: new JsonRpc.JsonRpcErrors.InternalError(),
                        id: requestId
                    }));
                }
            }
        });

        self.on('client disconnected', function(client){
            console.log('Closing connection: ' + client);
        });
    };

    /**
     * Init server commands
     */
    self.initServerCommands = function(){
        self.commands = new CommandManager();
        self.anonymousCommands = new CommandManager();

        // Install default modules
        self.installCommands(client.commands, true);
        self.installCommands(event.commands, false);

        // Install user-provided commands
        self.installCommands(self.options.commands, false);
        self.installCommands(self.options.anonymousCommands, true);
    };

    /**
     * Installs multiple commands on the server
     * @param {Object} commands
     * @param {boolean} anonymous
     */
    self.installCommands = function(commands, anonymous){
        for(var command in commands){
            self.installCommand(command, commands[command], anonymous);
        }
    };

    /**
     * Installs single command on the server
     * @param {string} command - command name
     * @param {function} method - method that will be executed upon the command
     * @param {boolean} anonymous - if true, method will be registered as anonymous, i.e. authentication not required
     */
    self.installCommand = function(command, method, anonymous){
        if(!anonymous)
            self.commands.set(command, method);
        else
            self.anonymousCommands.set(command, method);
    };

    /**
     * Run the server
     * @param {function} [callback] - Callback that runs when server is started
     */
    self.runServer = function(callback) {
        self.wss = new ws.Server(options, callback);

        // Server connection
        self.wss.on('connection', function(connection) {
            // Accept connection
            var client = new Client(connection);
            self.clients.push(client);

            client.on('request', function(request){
                self.emit('request', client, request);
            });

            client.on('close', function(){
                self.emit('client disconnected', client);

                var index = self.clients.indexOf(client);
                if (index != -1) {
                    self.clients.splice(index, 1);
                }
            });

            self.emit('client connected', client);
        });
    };

    /**
     * Shuts down the server
     * @param {function} [callback] - callback called when the server is closed
     */
    self.close = function(callback){
        var error = null;
        self.wss.close(function(wssError){
            if(callback)
                callback(error || wssError);
        });
    };

    self.options = options;
    self.db = null;
    self.clients = [];

    // Init the server

    // Init events
    self.initServerEvents();

    // Init database
    self.initDb();

    // Set different command sets
    self.initServerCommands();

    /*
    // Make sure server never crashes
    process.on('uncaughtException', function(err){
        console.error(err);
    });
    */
}

/**
 * Inherits from EventEmitter.
 */

util.inherits(RDataServer, EventEmitter);

module.exports = RDataServer;
