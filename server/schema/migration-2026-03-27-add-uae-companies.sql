-- Migration: Add UAE home renovation companies table
-- Date: 2026-03-27
-- Purpose: Store scraped UAE interior design / home renovation company data

USE tarmeer;

CREATE TABLE IF NOT EXISTS uae_companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255) DEFAULT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  logo_url MEDIUMTEXT DEFAULT NULL,
  description TEXT DEFAULT NULL,
  description_ar TEXT DEFAULT NULL,

  -- Contact info
  phone VARCHAR(64) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  website VARCHAR(512) DEFAULT NULL,
  whatsapp VARCHAR(64) DEFAULT NULL,

  -- Address
  city VARCHAR(128) DEFAULT NULL,
  area VARCHAR(255) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  latitude DECIMAL(10, 7) DEFAULT NULL,
  longitude DECIMAL(10, 7) DEFAULT NULL,

  -- Business info
  services JSON DEFAULT NULL,          -- e.g. ["interior design", "renovation", "fit-out"]
  specialties JSON DEFAULT NULL,       -- e.g. ["residential", "commercial", "hospitality"]
  price_range VARCHAR(64) DEFAULT NULL, -- e.g. "$$", "$$$"
  year_established VARCHAR(20) DEFAULT NULL,
  license_number VARCHAR(128) DEFAULT NULL,

  -- Ratings & reviews
  google_rating DECIMAL(2,1) DEFAULT NULL,
  google_reviews_count INT DEFAULT 0,
  source_platform VARCHAR(64) DEFAULT NULL,  -- where data was scraped from

  -- Social media
  instagram VARCHAR(512) DEFAULT NULL,
  facebook VARCHAR(512) DEFAULT NULL,
  linkedin VARCHAR(512) DEFAULT NULL,

  -- Portfolio images
  portfolio_images JSON DEFAULT NULL,  -- array of image URLs

  -- Status
  is_verified TINYINT(1) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  display_order INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_slug (slug),
  INDEX idx_city (city),
  INDEX idx_rating (google_rating),
  INDEX idx_active (is_active),
  INDEX idx_display_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
