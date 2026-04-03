-- Migration: Notification system
-- Date: 2026-04-03
-- Purpose: In-app notifications + configurable group email addresses

USE tarmeer;

-- ============================================================
-- 1. In-app notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL COMMENT 'NULL = broadcast to all admins',
  type ENUM('inquiry','company_registration','system') NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(512) DEFAULT NULL COMMENT 'Click-through URL',
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_read (user_id, is_read),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 2. Configurable notification email addresses (group send)
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_emails (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  label VARCHAR(128) DEFAULT NULL COMMENT 'Display name or role',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed with existing notification email
INSERT IGNORE INTO notification_emails (email, label) VALUES ('lvyiming@kp99.cn', 'Default Admin');

SELECT 'Notification system migration completed' AS result;
