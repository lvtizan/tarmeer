'use strict';
// Advisory locks must not occupy the pool used by the protected controllers.
// Otherwise enough concurrent writers can reserve every data connection and deadlock.
const config = require('../config').default.database;
module.exports = require('mysql2/promise').createPool({
 host:config.host,port:config.port,user:config.user,password:config.password,database:config.name,
 connectionLimit:4,waitForConnections:true,queueLimit:64,maxIdle:0,idleTimeout:60000,
 enableKeepAlive:true,
});
