# RData - Data Collection Instrument

Based on WebSockets, Json-RPC 2.0 and MongoDB


All code should be documented using JSDoc.

Before you write any new functionality, write test for it first.

JavaScript Style Guide: 
https://google.github.io/styleguide/javascriptguide.xml


TODO:
1. Re-factor error handling

⋅⋅⋅Every EventEmitter should handle it's own errors with on('error')

2. Replace ugly jsonparse with some other streaming json parser. 

⋅⋅⋅If there is no good replacement, maybe write our own Connection class.
⋅⋅⋅Something like a buffer that counts "{" and "}" and knows when json stream is ready to be parsed
