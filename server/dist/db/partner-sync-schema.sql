-- 合作方同步 · 暂存层（Plan 1）。幂等可重复执行。
CREATE TABLE IF NOT EXISTS partner_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  partner_key VARCHAR(64) NOT NULL UNIQUE,
  secret VARCHAR(128) NOT NULL,            -- HMAC 需原文重算，故存原文（后续可改加密存储）
  company_profile_id INT NULL,
  countries_json JSON NOT NULL,            -- 发布到哪些国家站，如 ["ae","vn"]
  default_lang VARCHAR(8) NOT NULL DEFAULT 'en',
  auto_approve_updates TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS partner_sync_requests (
  request_id VARCHAR(64) PRIMARY KEY,
  partner_id INT NOT NULL,
  endpoint VARCHAR(32) NOT NULL,
  response_json JSON NULL,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS partner_sync_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  partner_id INT NOT NULL,
  external_id VARCHAR(128) NOT NULL,
  payload_json JSON NOT NULL,              -- 多语言母本，原样存
  review_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  listing_status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  mapped_product_id INT NULL,              -- Plan 2 发布后回填
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  UNIQUE KEY uq_partner_external (partner_id, external_id)
);

CREATE TABLE IF NOT EXISTS partner_sync_companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  partner_id INT NOT NULL,
  payload_json JSON NOT NULL,
  review_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  mapped_company_id INT NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  UNIQUE KEY uq_partner (partner_id)
);
