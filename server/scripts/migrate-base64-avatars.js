/**
 * Migrate base64 avatar_url values to file-based uploads.
 * Converts data:image/... strings in designers.avatar_url to /uploads/avatars/{id}.{ext}
 *
 * Run on the server: node scripts/migrate-base64-avatars.js
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const DB_HOST = process.env.DB_HOST || 'rm-eb3t6y5093m91i2wzqo.mysql.dubai.rds.aliyuncs.com';
const DB_PORT = process.env.DB_PORT || 3306;
const DB_USER = process.env.DB_USER || 'tarmeerCRM';
const DB_PASSWORD = process.env.DB_PASSWORD || 'nyVaXDi6FEaFzakM';
const DB_NAME = process.env.DB_NAME || 'tarmeer';
const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads', 'avatars');

async function main() {
  const conn = await mysql.createConnection({
    host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: DB_NAME
  });

  // Find all designers with base64 avatars
  const [rows] = await conn.execute(
    "SELECT id, avatar_url FROM designers WHERE avatar_url LIKE 'data:%' AND deleted_at IS NULL"
  );

  console.log(`Found ${rows.length} designers with base64 avatars`);

  // Ensure uploads dir exists
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  let converted = 0;
  for (const row of rows) {
    try {
      const match = row.avatar_url.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/);
      if (!match) {
        console.log(`  #${row.id}: Skipped — unrecognized data URL format`);
        continue;
      }

      const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
      const buffer = Buffer.from(match[2], 'base64');
      const filename = `${row.id}.${ext}`;
      const filePath = path.join(UPLOADS_DIR, filename);
      const urlPath = `/uploads/avatars/${filename}`;

      fs.writeFileSync(filePath, buffer);

      await conn.execute(
        'UPDATE designers SET avatar_url = ? WHERE id = ?',
        [urlPath, row.id]
      );

      console.log(`  #${row.id}: Converted (${Math.round(buffer.length / 1024)}KB) → ${urlPath}`);
      converted++;
    } catch (err) {
      console.error(`  #${row.id}: Error — ${err.message}`);
    }
  }

  console.log(`\nDone: ${converted}/${rows.length} avatars converted to files.`);
  await conn.end();
}

main().catch(console.error);
