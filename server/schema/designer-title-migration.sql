SET @add_title_column = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'designers'
        AND COLUMN_NAME = 'title'
    ),
    'SELECT 1',
    'ALTER TABLE designers ADD COLUMN title VARCHAR(255) NULL AFTER full_name'
  )
);
PREPARE stmt FROM @add_title_column;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
