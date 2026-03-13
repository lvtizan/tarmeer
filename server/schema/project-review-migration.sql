ALTER TABLE projects
  MODIFY COLUMN status VARCHAR(32) DEFAULT 'draft';

SET @add_project_rejection_reason_column = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'projects'
        AND COLUMN_NAME = 'rejection_reason'
    ),
    'SELECT 1',
    'ALTER TABLE projects ADD COLUMN rejection_reason TEXT NULL AFTER status'
  )
);
PREPARE stmt FROM @add_project_rejection_reason_column;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
