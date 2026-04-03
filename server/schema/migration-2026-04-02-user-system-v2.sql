-- Migration: User System V2 - Three-Role Identity Model
-- Date: 2026-04-02
-- Purpose: Unified user system with homeowner/designer/company roles

USE tarmeer;

-- 1. Alter users table: add active_role and onboarding fields
ALTER TABLE users
  MODIFY COLUMN role ENUM('user','homeowner','designer','company') DEFAULT 'user';

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'tarmeer' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'active_role');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN active_role ENUM(\'homeowner\',\'designer\',\'company\') DEFAULT NULL AFTER role, ADD COLUMN onboarding_completed TINYINT(1) DEFAULT 0 AFTER active_role, ADD INDEX idx_active_role (active_role)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Migrate existing users
UPDATE users SET active_role = 'designer', onboarding_completed = 1 WHERE role = 'designer';
UPDATE users SET active_role = 'company', onboarding_completed = 1 WHERE role = 'company';
-- role='user' stays active_role=NULL → will see onboarding on next login

-- 3. Homeowner profiles table
CREATE TABLE IF NOT EXISTS homeowner_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  area_range VARCHAR(64) NOT NULL COMMENT '<50|50-100|100-200|200-500|>500 m²',
  city VARCHAR(128) NOT NULL,
  address TEXT DEFAULT NULL,
  phone VARCHAR(64) NOT NULL,
  stage VARCHAR(64) DEFAULT NULL COMMENT 'researching|has_design|ready_to_start|in_progress',
  budget_range VARCHAR(64) DEFAULT NULL COMMENT '<50K|50-100K|100-300K|300K-1M|>1M AED',
  notes TEXT DEFAULT NULL,
  assigned_designer_id INT DEFAULT NULL,
  assigned_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_city (city),
  INDEX idx_assigned (assigned_designer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Company profiles table (user-created, distinct from scraped uae_companies)
CREATE TABLE IF NOT EXISTS company_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  company_name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  contact_person VARCHAR(255) NOT NULL,
  phone VARCHAR(64) NOT NULL,
  website VARCHAR(512) DEFAULT NULL,
  city VARCHAR(128) NOT NULL,
  address TEXT NOT NULL,
  logo_url MEDIUMTEXT DEFAULT NULL,
  services JSON NOT NULL COMMENT '["Interior Design","Fit-Out",...]',
  -- Approval
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  admin_notes TEXT DEFAULT NULL,
  reviewed_by INT DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,
  display_order INT DEFAULT 0 COMMENT 'Admin-set display weight',
  -- Merge/claim
  linked_uae_company_id INT DEFAULT NULL COMMENT 'Merged with scraped company',
  merged_at DATETIME DEFAULT NULL,
  merged_by INT DEFAULT NULL COMMENT 'Admin who performed merge',
  -- Upgrade tracking
  upgraded_from_designer TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_status (status),
  INDEX idx_display_order (display_order),
  INDEX idx_linked_company (linked_uae_company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Add display_order to designers table (skip if already exists)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'tarmeer' AND TABLE_NAME = 'designers' AND COLUMN_NAME = 'display_order');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE designers ADD COLUMN display_order INT DEFAULT 0 COMMENT \'Admin-set display weight\'',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6. Extend projects table for company ownership (skip if already exists)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'tarmeer' AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'company_profile_id');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE projects ADD COLUMN company_profile_id INT DEFAULT NULL AFTER designer_id, ADD INDEX idx_company_profile (company_profile_id)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
