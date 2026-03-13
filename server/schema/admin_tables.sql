-- Tarmeer Admin System Tables
-- Run after init.sql: mysql -u root -p tarmeer < server/schema/admin_tables.sql

USE tarmeer;

-- Admin Users (super admin and sub-admins)
CREATE TABLE IF NOT EXISTS admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role ENUM('super_admin', 'sub_admin') DEFAULT 'sub_admin',
  permissions JSON DEFAULT NULL,
  -- permissions: { can_approve: true, can_sort: true, can_view_stats: true }
  is_active TINYINT(1) DEFAULT 1,
  last_login DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Designer Stats (daily aggregated)
CREATE TABLE IF NOT EXISTS designer_stats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  designer_id INT NOT NULL,
  stat_date DATE NOT NULL,
  profile_views INT DEFAULT 0,
  project_views INT DEFAULT 0,
  contact_clicks INT DEFAULT 0,
  phone_clicks INT DEFAULT 0,
  whatsapp_clicks INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_designer_date (designer_id, stat_date),
  INDEX idx_stat_date (stat_date),
  FOREIGN KEY (designer_id) REFERENCES designers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Activity Logs (audit trail)
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  action VARCHAR(64) NOT NULL,
  -- actions: login, approve_designer, reject_designer, update_order, create_admin, etc.
  target_type VARCHAR(64) DEFAULT NULL,
  -- target types: designer, project, admin, etc.
  target_id INT DEFAULT NULL,
  details JSON DEFAULT NULL,
  ip_address VARCHAR(64) DEFAULT NULL,
  user_agent VARCHAR(512) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin (admin_id),
  INDEX idx_action (action),
  INDEX idx_created (created_at),
  FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Raw page views (for detailed analytics, optional)
CREATE TABLE IF NOT EXISTS page_views (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  entity_type ENUM('designer', 'project') NOT NULL,
  entity_id INT NOT NULL,
  viewer_ip VARCHAR(64) DEFAULT NULL,
  viewer_fingerprint VARCHAR(64) DEFAULT NULL,
  referrer VARCHAR(512) DEFAULT NULL,
  user_agent VARCHAR(512) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Click events (contact clicks)
CREATE TABLE IF NOT EXISTS click_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  designer_id INT NOT NULL,
  click_type ENUM('phone', 'whatsapp', 'email', 'contact_form') NOT NULL,
  viewer_ip VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_designer (designer_id),
  INDEX idx_type (click_type),
  INDEX idx_created (created_at),
  FOREIGN KEY (designer_id) REFERENCES designers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add display_order to designers table
SET @add_display_order_column = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'designers'
        AND COLUMN_NAME = 'display_order'
    ),
    'SELECT 1',
    'ALTER TABLE designers ADD COLUMN display_order INT DEFAULT 0 AFTER is_approved'
  )
);
PREPARE stmt FROM @add_display_order_column;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_display_order_index = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'designers'
        AND INDEX_NAME = 'idx_display_order'
    ),
    'SELECT 1',
    'ALTER TABLE designers ADD INDEX idx_display_order (display_order)'
  )
);
PREPARE stmt FROM @add_display_order_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add rejection reason to designers table
SET @add_rejection_reason_column = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'designers'
        AND COLUMN_NAME = 'rejection_reason'
    ),
    'SELECT 1',
    'ALTER TABLE designers ADD COLUMN rejection_reason TEXT DEFAULT NULL AFTER is_approved'
  )
);
PREPARE stmt FROM @add_rejection_reason_column;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_status_column = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'designers'
        AND COLUMN_NAME = 'status'
    ),
    'SELECT 1',
    'ALTER TABLE designers ADD COLUMN status ENUM(''pending'', ''approved'', ''rejected'') DEFAULT ''pending'' AFTER is_approved'
  )
);
PREPARE stmt FROM @add_status_column;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add password reset columns to designers table
SET @add_reset_token_column = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'designers'
        AND COLUMN_NAME = 'reset_token'
    ),
    'SELECT 1',
    'ALTER TABLE designers ADD COLUMN reset_token VARCHAR(64) DEFAULT NULL AFTER verification_expires'
  )
);
PREPARE stmt FROM @add_reset_token_column;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_reset_expires_column = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'designers'
        AND COLUMN_NAME = 'reset_expires'
    ),
    'SELECT 1',
    'ALTER TABLE designers ADD COLUMN reset_expires DATETIME DEFAULT NULL AFTER reset_token'
  )
);
PREPARE stmt FROM @add_reset_expires_column;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_reset_index = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'designers'
        AND INDEX_NAME = 'idx_reset'
    ),
    'SELECT 1',
    'ALTER TABLE designers ADD INDEX idx_reset (reset_token)'
  )
);
PREPARE stmt FROM @add_reset_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing approved designers
UPDATE designers
SET
  status = CASE WHEN status IS NULL OR status = '' THEN 'approved' ELSE status END,
  display_order = CASE WHEN display_order IS NULL OR display_order = 0 THEN id ELSE display_order END
WHERE is_approved = 1;
