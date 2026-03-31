USE tarmeer;

-- 1. New users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(64) DEFAULT NULL,
  city VARCHAR(128) DEFAULT NULL,
  avatar_url MEDIUMTEXT DEFAULT NULL,
  role ENUM('user', 'designer', 'company') DEFAULT 'user',
  status ENUM('active', 'suspended') DEFAULT 'active',
  email_verified TINYINT(1) DEFAULT 0,
  verification_token VARCHAR(255) DEFAULT NULL,
  verification_token_expires DATETIME DEFAULT NULL,
  reset_token VARCHAR(255) DEFAULT NULL,
  reset_token_expires DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Link designers to users
ALTER TABLE designers ADD COLUMN user_id INT DEFAULT NULL AFTER id;
ALTER TABLE designers ADD INDEX idx_user_id (user_id);

-- 3. Link companies to users (owner who claimed it)
ALTER TABLE uae_companies ADD COLUMN owner_user_id INT DEFAULT NULL AFTER id;
ALTER TABLE uae_companies ADD INDEX idx_owner_user_id (owner_user_id);

-- 4. Design inquiry forms
CREATE TABLE IF NOT EXISTS design_inquiries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(64) NOT NULL,
  city VARCHAR(128) NOT NULL,
  area_range VARCHAR(64) NOT NULL,
  message TEXT DEFAULT NULL,
  designer_id INT DEFAULT NULL,
  company_id INT DEFAULT NULL,
  user_id INT DEFAULT NULL,
  status ENUM('new', 'contacted', 'resolved', 'archived') DEFAULT 'new',
  admin_notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_designer (designer_id),
  INDEX idx_company (company_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Company applications (user applies to become renovation company)
CREATE TABLE IF NOT EXISTS company_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  license_number VARCHAR(128) DEFAULT NULL,
  phone VARCHAR(64) DEFAULT NULL,
  city VARCHAR(128) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  documents JSON DEFAULT NULL,
  description TEXT DEFAULT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  admin_notes TEXT DEFAULT NULL,
  linked_company_id INT DEFAULT NULL,
  reviewed_by INT DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
