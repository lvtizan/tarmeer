-- Tarmeer backend: full DB init (MySQL)
-- Database: tarmeer
-- Run on Aliyun server: mysql -u root -p < server/schema/init.sql

CREATE DATABASE IF NOT EXISTS tarmeer
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE tarmeer;

-- Designers (registration, login, profile)
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
  INDEX idx_approved (is_approved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Projects (designer portfolios)
CREATE TABLE IF NOT EXISTS projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  designer_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  style VARCHAR(128) DEFAULT NULL,
  location VARCHAR(255) DEFAULT NULL,
  area VARCHAR(64) DEFAULT NULL,
  year VARCHAR(20) DEFAULT NULL,
  cost VARCHAR(64) DEFAULT NULL,
  images JSON DEFAULT NULL,
  tags JSON DEFAULT NULL,
  status VARCHAR(32) DEFAULT 'draft',
  rejection_reason TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_designer (designer_id),
  INDEX idx_status (status),
  FOREIGN KEY (designer_id) REFERENCES designers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Contacts (inquiries from site)
CREATE TABLE IF NOT EXISTS contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(64) DEFAULT NULL,
  type VARCHAR(64) NOT NULL,
  message TEXT DEFAULT NULL,
  designer_id INT DEFAULT NULL,
  project_id INT DEFAULT NULL,
  status VARCHAR(32) DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_designer (designer_id),
  FOREIGN KEY (designer_id) REFERENCES designers(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
