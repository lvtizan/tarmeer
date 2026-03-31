CREATE TABLE IF NOT EXISTS copyright_complaints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(64) DEFAULT NULL,
  content_url TEXT NOT NULL COMMENT 'URL of infringing content on our site',
  original_url TEXT DEFAULT NULL COMMENT 'URL of original copyrighted work',
  description TEXT NOT NULL,
  status ENUM('new', 'processing', 'resolved', 'rejected') DEFAULT 'new',
  admin_notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
