-- 合作方发布层：让 supplier 表容纳无账号的合作方数据。可重复执行需谨慎（ALTER 非幂等，下方用存在性判断）。
ALTER TABLE supplier_profiles MODIFY COLUMN supplier_user_id INT NULL;
ALTER TABLE supplier_profiles ADD COLUMN source ENUM('manual','partner') NOT NULL DEFAULT 'manual';
ALTER TABLE supplier_profiles ADD COLUMN partner_id INT NULL;
ALTER TABLE supplier_products ADD COLUMN source ENUM('manual','partner') NOT NULL DEFAULT 'manual';
ALTER TABLE supplier_products ADD COLUMN partner_external_id VARCHAR(128) NULL;
CREATE INDEX idx_sp_partner ON supplier_profiles (source, partner_id, country);
CREATE INDEX idx_sprod_partner ON supplier_products (source, partner_external_id);
