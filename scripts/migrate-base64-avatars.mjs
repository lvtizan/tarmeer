#!/usr/bin/env node
/**
 * Migrate base64 avatar data in users and designers tables to file storage.
 *
 * Usage:
 *   node scripts/migrate-base64-avatars.mjs          # dry run
 *   node scripts/migrate-base64-avatars.mjs --apply   # actually migrate
 *
 * For remote DB, set env vars: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 */

import mysql from 'mysql2/promise';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', 'server', 'public', 'uploads', 'avatars');
const DATA_URL_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/;

const dryRun = !process.argv.includes('--apply');

function getExt(mime) {
  const map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
  return map[mime.toLowerCase()] || 'jpg';
}

async function migrate() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tarmeer',
  });

  console.log(`Mode: ${dryRun ? 'DRY RUN (use --apply to execute)' : 'APPLYING CHANGES'}\n`);

  await fs.mkdir(UPLOADS_DIR, { recursive: true });

  const tables = [
    { table: 'users', idCol: 'id', urlCol: 'avatar_url' },
    { table: 'designers', idCol: 'id', urlCol: 'avatar_url' },
  ];

  let totalMigrated = 0;

  for (const { table, idCol, urlCol } of tables) {
    const [rows] = await pool.execute(
      `SELECT ${idCol}, ${urlCol} FROM ${table} WHERE ${urlCol} LIKE 'data:%'`
    );

    console.log(`[${table}] Found ${rows.length} base64 records`);

    for (const row of rows) {
      const match = row[urlCol].match(DATA_URL_RE);
      if (!match) {
        console.log(`  [SKIP] ${table}.${idCol}=${row[idCol]} — invalid data URL`);
        continue;
      }

      const mime = match[1];
      const base64 = match[2].replace(/\s+/g, '');
      const buffer = Buffer.from(base64, 'base64');
      const ext = getExt(mime);
      const fileName = `${row[idCol]}-${randomUUID().slice(0, 8)}.${ext}`;
      const filePath = path.join(UPLOADS_DIR, fileName);
      const relativeUrl = `/uploads/avatars/${fileName}`;

      console.log(`  ${table}.${idCol}=${row[idCol]}: ${(buffer.length / 1024).toFixed(1)}KB → ${relativeUrl}`);

      if (!dryRun) {
        await fs.writeFile(filePath, buffer);
        await pool.execute(`UPDATE ${table} SET ${urlCol} = ? WHERE ${idCol} = ?`, [relativeUrl, row[idCol]]);
      }

      totalMigrated++;
    }
  }

  console.log(`\nTotal: ${totalMigrated} records ${dryRun ? 'would be' : ''} migrated`);
  await pool.end();
}

migrate().catch((err) => { console.error('Migration failed:', err); process.exit(1); });
