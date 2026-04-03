-- Migration: Fix designer-to-company upgrade gaps
-- Date: 2026-04-03
-- Purpose:
--   1. Fix empty company_name for upgraded designers (use email prefix if no name)
--   2. Link orphan designers (no user_id) to users table, then upgrade them
--   3. Ensure ALL designers have a corresponding company_profile

USE tarmeer;

-- ============================================================
-- 1. Link orphan designers (have email but no user_id) to existing users
-- ============================================================
UPDATE designers d
JOIN users u ON u.email = d.email
SET d.user_id = u.id
WHERE d.user_id IS NULL
  AND d.deleted_at IS NULL;

-- ============================================================
-- 2. Create users for designers that still have no user_id
-- ============================================================
-- These designers registered via old system and never got a users row
INSERT IGNORE INTO users (email, password, full_name, phone, city, avatar_url, role, active_role, onboarding_completed, email_verified, status)
SELECT
  d.email,
  COALESCE(d.password, ''),
  COALESCE(d.full_name, SUBSTRING_INDEX(d.email, '@', 1)),
  COALESCE(d.phone, ''),
  COALESCE(d.city, 'Dubai'),
  COALESCE(d.avatar_url, ''),
  'company',
  'company',
  1,
  1,
  'active'
FROM designers d
WHERE d.user_id IS NULL
  AND d.deleted_at IS NULL
  AND d.email IS NOT NULL;

-- Link them
UPDATE designers d
JOIN users u ON u.email = d.email
SET d.user_id = u.id
WHERE d.user_id IS NULL
  AND d.deleted_at IS NULL;

-- ============================================================
-- 3. Upgrade remaining designers without company_profiles
-- ============================================================
INSERT IGNORE INTO company_profiles (
  user_id, company_name, company_type, description, contact_person,
  phone, city, address, services, upgraded_from_designer, status
)
SELECT
  d.user_id,
  CONCAT(
    COALESCE(NULLIF(TRIM(d.full_name), ''), SUBSTRING_INDEX(d.email, '@', 1)),
    ' Design Studio'
  ),
  'design_studio',
  COALESCE(d.bio, ''),
  COALESCE(d.full_name, SUBSTRING_INDEX(d.email, '@', 1)),
  COALESCE(d.phone, ''),
  COALESCE(d.city, 'Dubai'),
  COALESCE(d.address, ''),
  '["Interior Design"]',
  1,
  CASE WHEN d.status = 'approved' THEN 'approved' ELSE 'pending' END
FROM designers d
WHERE d.user_id IS NOT NULL
  AND d.deleted_at IS NULL
  AND d.user_id NOT IN (SELECT user_id FROM company_profiles);

-- ============================================================
-- 4. Fix company_name for previously upgraded designers with empty names
-- ============================================================
UPDATE company_profiles cp
JOIN users u ON cp.user_id = u.id
SET cp.company_name = CONCAT(
  COALESCE(NULLIF(TRIM(u.full_name), ''), SUBSTRING_INDEX(u.email, '@', 1)),
  ' Design Studio'
)
WHERE cp.upgraded_from_designer = 1
  AND (cp.company_name IS NULL OR TRIM(cp.company_name) = '' OR cp.company_name = ' Design Studio');

-- ============================================================
-- 5. Ensure all upgraded designers have active_role = 'company'
-- ============================================================
UPDATE users u
JOIN company_profiles cp ON cp.user_id = u.id
SET u.active_role = 'company', u.role = 'company', u.onboarding_completed = 1
WHERE cp.upgraded_from_designer = 1
  AND (u.active_role IS NULL OR u.active_role != 'company');

-- ============================================================
-- 6. Link orphan projects to company_profiles
-- ============================================================
UPDATE projects p
JOIN designers d ON p.designer_id = d.id
JOIN company_profiles cp ON cp.user_id = d.user_id AND cp.upgraded_from_designer = 1
SET p.company_profile_id = cp.id
WHERE p.company_profile_id IS NULL;

SELECT 'Designer upgrade fix migration completed' AS result;
