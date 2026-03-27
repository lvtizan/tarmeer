-- Migration: Ensure designer status defaults are correct
-- Date: 2026-03-23
-- Issue: Newly registered designers may not have proper status

USE tarmeer;

-- 1. Fix avatar_url field (from previous migration)
ALTER TABLE designers MODIFY COLUMN avatar_url MEDIUMTEXT DEFAULT NULL;

-- 2. Ensure status field has proper default and constraints
ALTER TABLE designers
  MODIFY COLUMN status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' NOT NULL;

-- 3. Ensure is_approved field defaults correctly
ALTER TABLE designers
  MODIFY COLUMN is_approved TINYINT(1) DEFAULT 0 NOT NULL;

-- 4. Fix any existing designers with NULL status
UPDATE designers
SET status = 'pending', is_approved = 0
WHERE status IS NULL OR status = '';

-- 5. Fix any existing designers with status inconsistency
UPDATE designers
SET status = 'approved', is_approved = 1
WHERE is_approved = 1 AND status != 'approved';

UPDATE designers
SET status = 'pending', is_approved = 0
WHERE is_approved = 0 AND status IN ('approved', 'rejected');

-- 6. Verify the fixes
SELECT
    'Status distribution' as check_type,
    status,
    is_approved,
    COUNT(*) as count
FROM designers
GROUP BY status, is_approved
ORDER BY status;

SELECT
    'Schema verification' as check_type,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'tarmeer'
  AND TABLE_NAME = 'designers'
  AND COLUMN_NAME IN ('status', 'is_approved', 'avatar_url')
ORDER BY COLUMN_NAME;

-- Expected results:
-- status distribution should show:
-- - pending | 0 | X (most new designers)
-- - approved | 1 | X (approved designers)
-- - rejected | 0 | X (rejected designers)
--
-- schema should show:
-- - status | enum | NO | pending | enum('pending','approved','rejected')
-- - is_approved | tinyint | NO | 0 | tinyint(1)
-- - avatar_url | mediumtext | YES | NULL | mediumtext
