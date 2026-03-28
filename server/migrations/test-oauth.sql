-- OAuth 功能测试
-- 验证字段是否正确添加

SELECT
  COLUMN_NAME,
  DATA_TYPE,
  IS_NULLABLE,
  COLUMN_KEY
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'designers'
  AND COLUMN_NAME IN ('google_id', 'facebook_id', 'avatar_url', 'oauth_provider')
ORDER BY COLUMN_NAME;
