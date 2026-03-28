-- OAuth 登录功能 - 添加字段
-- 执行日期: 2025-03-28

-- OAuth 提供商 ID
ALTER TABLE designers ADD COLUMN google_id VARCHAR(255) NULL UNIQUE;
ALTER TABLE designers ADD COLUMN facebook_id VARCHAR(255) NULL UNIQUE;

-- 头像 URL（本地存储路径）
ALTER TABLE designers ADD COLUMN avatar_url VARCHAR(500) NULL;

-- OAuth 提供商标识
ALTER TABLE designers ADD COLUMN oauth_provider ENUM('google', 'facebook', NULL) NULL;

-- 索引优化
CREATE INDEX idx_oauth_google ON designers(google_id);
CREATE INDEX idx_oauth_facebook ON designers(facebook_id);
