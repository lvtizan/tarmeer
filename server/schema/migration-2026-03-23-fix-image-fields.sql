-- Migration: Fix image field types for base64 data storage
-- Date: 2026-03-23
-- Issue: avatar_url and images fields too small for base64 data
-- Impact: Designers cannot upload avatars, project images fail to save

USE tarmeer;

-- 1. Fix avatar_url field to support large base64 data (up to 16MB)
-- This fixes the "Data too long for column 'avatar_url'" error
ALTER TABLE designers MODIFY COLUMN avatar_url MEDIUMTEXT DEFAULT NULL;

-- 2. Ensure projects.images field can handle large JSON arrays
-- JSON type should be sufficient, but verify it's properly configured
ALTER TABLE projects MODIFY COLUMN images JSON DEFAULT NULL;

-- 3. Verify the changes
SELECT
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'tarmeer'
  AND TABLE_NAME IN ('designers', 'projects')
  AND COLUMN_NAME IN ('avatar_url', 'images')
ORDER BY TABLE_NAME, COLUMN_NAME;

-- Expected output:
-- designers | avatar_url | mediumtext | NULL  | mediumtext
-- projects  | images     | json       | NULL  | json
