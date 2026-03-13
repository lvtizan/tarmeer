-- Tarmeer 4.0 数据库结构
-- 创建数据库
CREATE DATABASE IF NOT EXISTS tarmeer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tarmeer;

-- 设计师表
CREATE TABLE IF NOT EXISTS designers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  phone VARCHAR(50),
  city VARCHAR(100),
  address TEXT,
  bio TEXT,
  avatar_url VARCHAR(500),
  style VARCHAR(255),
  expertise JSON,
  is_approved BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE,
  display_order INT DEFAULT 0,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  rejection_reason TEXT,
  verification_token VARCHAR(255),
  verification_expires TIMESTAMP,
  reset_token VARCHAR(255),
  reset_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_verification_token (verification_token),
  INDEX idx_reset_token (reset_token),
  INDEX idx_display_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 项目表
CREATE TABLE IF NOT EXISTS projects (
  id INT PRIMARY KEY AUTO_INCREMENT,
  designer_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  style VARCHAR(100),
  location VARCHAR(255),
  area VARCHAR(50),
  year INT,
  cost VARCHAR(100),
  images JSON,
  tags JSON,
  status ENUM('draft', 'pending', 'published', 'rejected') DEFAULT 'draft',
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (designer_id) REFERENCES designers(id) ON DELETE CASCADE,
  INDEX idx_designer_id (designer_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 联系表单表
CREATE TABLE IF NOT EXISTS contacts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  type ENUM('inquiry', 'quote', 'partnership') NOT NULL,
  message TEXT,
  designer_id INT,
  project_id INT,
  status ENUM('new', 'read', 'replied') DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (designer_id) REFERENCES designers(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
