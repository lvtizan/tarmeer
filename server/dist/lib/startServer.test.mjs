import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const startup = await import('./startServer.js').catch(() => ({}));

test('required migration 完成前绝不 listen', async () => {
  assert.equal(typeof startup.startAfterRequiredMigrations, 'function');
  let resolveMigration;
  const events = [];
  const migration = new Promise((resolve) => { resolveMigration = resolve; });
  const starting = startup.startAfterRequiredMigrations({
    migrate: async () => { events.push('migrate:start'); await migration; events.push('migrate:end'); },
    listen: async () => { events.push('listen'); return 'server'; },
    cleanup: async () => { events.push('cleanup'); },
  });
  await Promise.resolve();
  assert.deepEqual(events, ['migrate:start']);
  resolveMigration();
  assert.equal(await starting, 'server');
  assert.deepEqual(events, ['migrate:start', 'migrate:end', 'listen']);
});

test('required migration 失败会 cleanup、拒绝启动且不 listen', async () => {
  assert.equal(typeof startup.startAfterRequiredMigrations, 'function');
  const events = [];
  await assert.rejects(() => startup.startAfterRequiredMigrations({
    migrate: async () => { events.push('migrate'); throw new Error('required migration failed'); },
    listen: async () => { events.push('listen'); return 'server'; },
    cleanup: async () => { events.push('cleanup'); },
  }), /required migration failed/);
  assert.deepEqual(events, ['migrate', 'cleanup']);
});

test('autoMigrate strict 向上传播失败，默认模式保持既有容错', async () => {
  const require = createRequire(import.meta.url);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const commonDir = path.resolve(root, execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim());
  process.env.NODE_PATH = path.join(path.dirname(commonDir), 'server/node_modules');
  require('module').Module._initPaths();
  const pool = require('../config/database.js').default;
  const { runAutoMigrate } = require('./autoMigrate.js');
  const originalExecute = pool.execute;
  const originalError = console.error;
  pool.execute = async () => { throw new Error('synthetic migration failure'); };
  console.error = () => {};
  try {
    await assert.rejects(() => runAutoMigrate({ strict: true }), /synthetic migration failure/);
    await assert.doesNotReject(() => runAutoMigrate());
  } finally {
    pool.execute = originalExecute;
    console.error = originalError;
    await pool.end();
  }
});

test('真实 production entry 把 strict migration 放在 listen 前', async () => {
  const events = [];
  let strictOption = null;
  assert.equal(typeof startup.startProductionServer, 'function');
  await startup.startProductionServer({
    runAutoMigrate: async (options) => { strictOption = options; events.push('migrate'); },
    listen: async () => { events.push('listen'); return 'server'; },
    cleanup: async () => { events.push('cleanup'); },
  });
  assert.deepEqual(strictOption, { strict: true });
  assert.deepEqual(events, ['migrate', 'listen']);

  const appSource = await import('node:fs/promises').then(({ readFile }) => readFile(
    new URL('../app.js', import.meta.url),
    'utf8',
  ));
  const entryBody = appSource.slice(appSource.indexOf('async function startProductionServer'));
  assert.match(entryBody, /startServer_1\.startProductionServer/);
  assert.match(entryBody, /runAutoMigrate,/);
});
