-- Tarmeer backend: designers table (MySQL)
-- Run this on the server DB if registration fails with "table doesn't exist" or column errors.
-- Usage: mysql -u root -p tarmeer < server/schema/designers.sql

CREATE TABLE IF NOT EXISTS designers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  title VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(64) DEFAULT NULL,
  city VARCHAR(128) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  bio TEXT DEFAULT NULL,
  avatar_url VARCHAR(512) DEFAULT NULL,
  style VARCHAR(255) DEFAULT NULL,
  expertise JSON DEFAULT NULL,
  is_approved TINYINT(1) DEFAULT 0,
  email_verified TINYINT(1) DEFAULT 0,
  display_order INT DEFAULT 0,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  rejection_reason TEXT DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by_admin_id INT DEFAULT NULL,
  delete_reason TEXT DEFAULT NULL,
  verification_token VARCHAR(64) DEFAULT NULL,
  verification_expires DATETIME DEFAULT NULL,
  reset_token VARCHAR(64) DEFAULT NULL,
  reset_expires DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_verification (verification_token),
  INDEX idx_reset (reset_token),
  INDEX idx_display_order (display_order),
  INDEX idx_approved (is_approved),
  INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
