/**
 * Run init.sql or init-tables-only.sql against RDS using Node mysql2.
 * Usage (full init, if user can create DB):
 *   DB_HOST=rm-xxx... DB_USER=tarmeerCRM DB_PASSWORD='...' DB_NAME=tarmeer node server/schema/run-init-with-node.js
 * Usage (tables only, after creating DB in RDS console and granting user access):
 *   DB_TABLES_ONLY=1 DB_HOST=rm-xxx... DB_USER=tarmeerCRM DB_PASSWORD='...' DB_NAME=tarmeer node server/schema/run-init-with-node.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'tarmeer';
const TABLES_ONLY = process.env.DB_TABLES_ONLY === '1' || process.env.DB_TABLES_ONLY === 'true';

function loadSql(filename) {
  const sqlPath = path.join(__dirname, filename);
  return fs
    .readFileSync(sqlPath, 'utf8')
    .replace(/CREATE DATABASE IF NOT EXISTS tarmeer/g, `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``)
    .replace(/USE tarmeer;/g, `USE \`${DB_NAME}\`;`);
}

async function main() {
  if (!DB_HOST || !DB_USER) {
    console.error('Set DB_HOST, DB_USER, DB_PASSWORD, (DB_NAME). Example:');
    console.error("  DB_HOST=rm-xxx.mysql.dubai.rds.aliyuncs.com DB_USER=tarmeerCRM DB_PASSWORD='pass' DB_NAME=tarmeer node server/schema/run-init-with-node.js");
    process.exit(1);
  }

  console.log('Connecting to', DB_HOST, '...');
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: TABLES_ONLY ? DB_NAME : undefined,
    multipleStatements: true,
  });

  try {
    const migrationFiles = [
      'admin_tables.sql',
      'designer-title-migration.sql',
      'project-review-migration.sql',
      'avatar-url-migration.sql',
    ];

    if (TABLES_ONLY) {
      const sql = loadSql('init-tables-only.sql');
      console.log('Running init-tables-only.sql in database', DB_NAME, '...');
      await conn.query(sql);
      for (const file of migrationFiles) {
        const migrationSql = loadSql(file);
        console.log(`Applying ${file} ...`);
        await conn.query(migrationSql);
      }
      console.log('Done. Tables, admin schema, and migrations are ready.');
    } else {
      const sql = loadSql('init.sql');
      console.log('Running init.sql (create database and tables)...');
      await conn.query(sql);

      await conn.changeUser({ database: DB_NAME });
      for (const file of migrationFiles) {
        const migrationSql = loadSql(file);
        console.log(`Applying ${file} ...`);
        await conn.query(migrationSql);
      }

      console.log('Done. Database', DB_NAME, 'base schema, admin schema, and migrations are ready.');
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
