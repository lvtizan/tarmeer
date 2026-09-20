#!/usr/bin/env node

const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const { default: app, startProductionServer } = require(path.join(root, 'server/dist/app.js'));
const pool = require(path.join(root, 'server/dist/config/database.js')).default;
const port = Number(process.env.PORT);
const nonce = process.env.TARMEER_HARNESS_NONCE;

if (!Number.isInteger(port) || port <= 0 || !nonce) {
  console.error('[harness-startup] Missing isolated port or nonce.');
  process.exit(1);
}

const listen = () => new Promise((resolve, reject) => {
  const server = app.listen({ port, host: '127.0.0.1', exclusive: true }, () => {
    server.off('error', reject);
    console.log(`HARNESS_READY ${nonce} 127.0.0.1:${port}`);
    resolve(server);
  });
  server.once('error', reject);
});

startProductionServer({ listen, cleanup: () => pool.end() })
  .then((server) => {
    const shutdown = () => server.close(() => pool.end().finally(() => process.exit(0)));
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  })
  .catch((error) => {
    console.error('[harness-startup] Isolated backend refused to start:', error);
    process.exit(1);
  });
