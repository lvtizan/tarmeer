import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { rewriteSchemaSql } from './schemaSql';

test('rewriteSchemaSql swaps default database name in create and use statements', () => {
  const sql = [
    'CREATE DATABASE IF NOT EXISTS tarmeer CHARACTER SET utf8mb4;',
    'USE tarmeer;',
    'CREATE TABLE designers (id INT PRIMARY KEY);',
  ].join('\n');

  const result = rewriteSchemaSql(sql, 'tarmeer_staging');

  assert.match(result, /CREATE DATABASE IF NOT EXISTS `tarmeer_staging` CHARACTER SET utf8mb4;/);
  assert.match(result, /USE `tarmeer_staging`;/);
  assert.doesNotMatch(result, /USE tarmeer;/);
});

test('schema files include soft delete fields for designers', () => {
  const root = path.resolve(process.cwd(), '..');
  const serverSchema = fs.readFileSync(path.join(root, 'server/schema/designers.sql'), 'utf8');
  const appSchema = fs.readFileSync(path.join(root, 'database/schema.sql'), 'utf8');

  for (const sql of [serverSchema, appSchema]) {
    assert.match(sql, /deleted_at/i);
    assert.match(sql, /deleted_by_admin_id/i);
    assert.match(sql, /delete_reason/i);
  }
});

test('schema files allow long avatar payloads for designer profile updates', () => {
  const root = path.resolve(process.cwd(), '..');
  const schemaFiles = [
    path.join(root, 'server/schema/designers.sql'),
    path.join(root, 'server/schema/init.sql'),
    path.join(root, 'server/schema/init-tables-only.sql'),
    path.join(root, 'database/schema.sql'),
  ];

  for (const filePath of schemaFiles) {
    const sql = fs.readFileSync(filePath, 'utf8');
    assert.match(sql, /avatar_url\s+(TEXT|MEDIUMTEXT|LONGTEXT)/i);
    assert.doesNotMatch(sql, /avatar_url\s+varchar\s*\(\s*5\d{2}\s*\)/i);
  }
});
