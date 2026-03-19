SET @ensure_avatar_url_mediumtext = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'designers'
        AND COLUMN_NAME = 'avatar_url'
        AND DATA_TYPE IN ('mediumtext', 'longtext')
    ),
    'SELECT 1',
    'ALTER TABLE designers MODIFY COLUMN avatar_url MEDIUMTEXT DEFAULT NULL'
  )
);
PREPARE stmt FROM @ensure_avatar_url_mediumtext;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
