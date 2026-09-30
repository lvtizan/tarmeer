"use strict";
/** Required startup/preflight migration. Errors propagate; callers must not listen before this succeeds. */
async function ensureSourcingRequestSchema(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS sourcing_requests (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    request_type ENUM('sample','visit','sourcing','designer_partner','quote') NOT NULL,
    name VARCHAR(120) NOT NULL, phone VARCHAR(40) NOT NULL, email VARCHAR(160) NULL,
    company_name VARCHAR(160) NULL, city VARCHAR(80) NULL, message TEXT NULL,
    preferred_date VARCHAR(40) NULL, product_id INT NULL, supplier_profile_id INT NULL,
    source_page VARCHAR(500) NULL, country VARCHAR(5) NOT NULL DEFAULT 'ae',
    status ENUM('new','contacted','completed','rejected') NOT NULL DEFAULT 'new',
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    request_context JSON NULL, request_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    UNIQUE KEY uq_sourcing_request_key (request_key),
    KEY idx_sourcing_country_status (country,status), KEY idx_sourcing_type (request_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  let [columns] = await db.query('SHOW COLUMNS FROM sourcing_requests');
  const requestType = columns.find(c => c.Field === 'request_type');
  if (requestType?.Type.startsWith('enum(') && !requestType.Type.includes("'quote'")) {
    // Preserve every existing enum member, nullability and default; append only the new member.
    const extended = requestType.Type.slice(0,-1) + ",'quote')";
    const defaultSql = requestType.Default !== null ? ` DEFAULT ${db.escape(requestType.Default)}` : requestType.Null === 'YES' ? ' DEFAULT NULL' : '';
    await db.query(`ALTER TABLE sourcing_requests MODIFY request_type ${extended} ${requestType.Null === 'YES' ? 'NULL' : 'NOT NULL'}${defaultSql}`);
  }
  if (!columns.some(c => c.Field === 'request_context')) await db.query('ALTER TABLE sourcing_requests ADD COLUMN request_context JSON NULL');
  if (!columns.some(c => c.Field === 'request_key')) await db.query('ALTER TABLE sourcing_requests ADD COLUMN request_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL');
  let [indexes] = await db.query('SHOW INDEX FROM sourcing_requests');
  if (!indexes.some(i => i.Key_name === 'uq_sourcing_request_key')) await db.query('ALTER TABLE sourcing_requests ADD UNIQUE KEY uq_sourcing_request_key (request_key)');
  [columns] = await db.query('SHOW COLUMNS FROM sourcing_requests');
  [indexes] = await db.query('SHOW INDEX FROM sourcing_requests');
  const type = columns.find(c=>c.Field === 'request_type')?.Type || '';
  const key = columns.find(c=>c.Field === 'request_key');
  const unique = indexes.filter(i=>i.Key_name === 'uq_sourcing_request_key');
  if (columns.find(c=>c.Field === 'request_context')?.Type !== 'json' || !key || !/^varchar\((?:6[4-9]|[7-9]\d|\d{3,})\)$/.test(key.Type) || unique.length !== 1 || Number(unique[0].Non_unique) !== 0 || unique[0].Column_name !== 'request_key' || unique[0].Sub_part != null || (type.startsWith('enum(') && !type.includes("'quote'"))) throw Error('Required sourcing request schema is incompatible');
}
module.exports = {ensureSourcingRequestSchema};
