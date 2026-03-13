import test from 'node:test';
import assert from 'node:assert/strict';
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
