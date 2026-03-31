USE tarmeer;

-- Create user records from existing designers (only those with email, not deleted)
INSERT INTO users (email, password, full_name, phone, city, avatar_url, role, email_verified, created_at)
SELECT
  d.email, COALESCE(d.password, ''), d.full_name, d.phone, d.city, d.avatar_url,
  'designer', d.email_verified, d.created_at
FROM designers d
WHERE d.email IS NOT NULL
  AND d.deleted_at IS NULL
  AND d.user_id IS NULL
ON DUPLICATE KEY UPDATE users.id = users.id;  -- skip if email already exists

-- Link designers to their new user records
UPDATE designers d
  JOIN users u ON u.email = d.email
SET d.user_id = u.id
WHERE d.user_id IS NULL AND d.deleted_at IS NULL;
