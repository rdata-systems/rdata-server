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
1. Re-factor error handling

⋅⋅⋅Every EventEmitter should handle it's own errors with on('error')

2. (!!!) Replace ugly jsonparse with some other streaming async json parser. 

⋅⋅⋅If there is no good replacement, maybe write our own Connection class.
⋅⋅⋅Something like a buffer that counts "{" and "}" and knows when json stream is ready to be parsed

3. Check if it's necessary to wait all modules finish doing dbInit before running up the websocket server (and if yes, think about how to do it.. using promises maybe?)

4. Re-think namings.. rename events to something like DataEvent ?