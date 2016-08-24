# RData - Data Collection Instrument

Based on WebSockets, Json-RPC 2.0 and MongoDB


## Code style
All code should be documented using JSDoc.

Callbacks must accept error as their first argument.

JavaScript Style Guide: 
https://google.github.io/styleguide/javascriptguide.xml


## Unit tests
Before you write any new functionality, write test for it first.
When writing async tests, always call done(), and only after server 
closed:
~~~~ 
server.close(function(error) {
    done(error);
});
~~~~ 

In this example, if error is presented it will be passed to the done()

## TODO:
0. Implement batch request functionality, using json-rpc 2 batch requests

1. Make sure that EndContextRecursive is not crashing the server (implement max. recursion depth)

2. Make sure that all user contexts are properly closed when server is terminated

3. Write tests to cover auto-events (events that happen when user sends a specific request, like startContextEvent)