/** Run locally for development, or copy to server and run there with APP_ROOT=/tarmeer/tarmeer_api.
 * Production DB writes are prohibited from a local machine. Additive and idempotent. */
const path = require('path');
const root = process.env.APP_ROOT || path.resolve(__dirname,'../../server');
require(path.join(root,'node_modules/dotenv')).config({path:path.join(root,'.env')});
if (!['localhost','127.0.0.1'].includes(process.env.DB_HOST) && root !== '/tarmeer/tarmeer_api') throw Error('Production migration must run on server with APP_ROOT=/tarmeer/tarmeer_api');
const mysql = require(path.join(root,'node_modules/mysql2/promise'));
(async()=>{
 const connection = await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT)||3306,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});
 try {
  await require(path.join(root,'dist/lib/sourcingRequestSchema')).ensureSourcingRequestSchema(connection);
  console.log('PASS sourcing request context and idempotency schema');
 } finally {await connection.end();}
})().catch(error=>{console.error(error.code || error.message);process.exitCode=1});
