-- Migration V3: Dual-Role System (Homeowner + Company)
-- Date: 2026-04-02
-- Purpose: Simplify from 3-role to 2-role, remove independent designer,
--          upgrade existing designers to company (design_studio)
-- Run AFTER migration-2026-04-02-user-system-v2.sql

USE tarmeer;

-- ============================================================
-- 1. Update active_role ENUM to only homeowner/company
-- ============================================================
-- First: migrate existing designer-role users to company
UPDATE users SET active_role = 'company' WHERE active_role = 'designer';

-- Change the ENUM (keeping 'designer' temporarily for backward compat)
ALTER TABLE users
  MODIFY COLUMN role ENUM('user','homeowner','designer','company') DEFAULT 'user',
  MODIFY COLUMN active_role ENUM('homeowner','company') DEFAULT NULL;

-- ============================================================
-- 2. Add new fields to company_profiles
-- ============================================================

-- company_type: design_studio or renovation_company
SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA='tarmeer' AND TABLE_NAME='company_profiles' AND COLUMN_NAME='company_type');
SET @q = IF(@col=0,
  'ALTER TABLE company_profiles ADD COLUMN company_type ENUM(\'design_studio\',\'renovation_company\') NOT NULL DEFAULT \'renovation_company\' AFTER company_name',
  'SELECT 1');
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

-- trade_license_number (营业执照号)
SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA='tarmeer' AND TABLE_NAME='company_profiles' AND COLUMN_NAME='trade_license_number');
SET @q = IF(@col=0,
  'ALTER TABLE company_profiles ADD COLUMN trade_license_number VARCHAR(128) DEFAULT NULL AFTER address',
  'SELECT 1');
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

-- establishment_year (成立年份)
SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA='tarmeer' AND TABLE_NAME='company_profiles' AND COLUMN_NAME='establishment_year');
SET @q = IF(@col=0,
  'ALTER TABLE company_profiles ADD COLUMN establishment_year SMALLINT DEFAULT NULL AFTER trade_license_number',
  'SELECT 1');
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

-- specialties JSON (项目类型：Residential, Villa, Commercial, etc.)
SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA='tarmeer' AND TABLE_NAME='company_profiles' AND COLUMN_NAME='specialties');
SET @q = IF(@col=0,
  'ALTER TABLE company_profiles ADD COLUMN specialties JSON DEFAULT NULL COMMENT \'["Residential","Villa","Commercial",...]\' AFTER services',
  'SELECT 1');
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

-- ============================================================
-- 3. Auto-upgrade existing designers to company_profiles
-- ============================================================
-- For each designer who doesn't already have a company_profile,
-- create one as design_studio type
INSERT IGNORE INTO company_profiles (
  user_id, company_name, company_type, description, contact_person,
  phone, city, address, services, upgraded_from_designer, status
)
SELECT
  d.user_id,
  CONCAT(d.full_name, ' Design Studio'),
  'design_studio',
  COALESCE(d.bio, ''),
  COALESCE(d.full_name, ''),
  COALESCE(d.phone, ''),
  COALESCE(d.city, 'Dubai'),
  COALESCE(d.address, ''),
  '["Interior Design"]',
  1,
  d.status
FROM designers d
WHERE d.user_id IS NOT NULL
  AND d.user_id NOT IN (SELECT user_id FROM company_profiles);

-- Link existing designer projects to the new company_profile
UPDATE projects p
JOIN designers d ON p.designer_id = d.id
JOIN company_profiles cp ON cp.user_id = d.user_id AND cp.upgraded_from_designer = 1
SET p.company_profile_id = cp.id
WHERE p.company_profile_id IS NULL;

-- ============================================================
-- 4. Add before_after support to projects
-- ============================================================
SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA='tarmeer' AND TABLE_NAME='projects' AND COLUMN_NAME='is_before_after');
SET @q = IF(@col=0,
  'ALTER TABLE projects ADD COLUMN is_before_after TINYINT(1) DEFAULT 0 COMMENT \'Before/After comparison project\'',
  'SELECT 1');
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

SELECT 'V3 Dual-Role migration completed successfully' AS result;
