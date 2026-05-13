-- CRM × Mall integration fields on company_profiles
-- Safe to run multiple times (IF NOT EXISTS / IF EXISTS guards)
ALTER TABLE company_profiles
  ADD COLUMN crm_tenant_id       VARCHAR(100) NULL COMMENT 'CRM tenant ID after provision',
  ADD COLUMN crm_provisioned_at  DATETIME     NULL,
  ADD COLUMN crm_mall_partner_id VARCHAR(50)  NULL COMMENT 'equals id::string, idempotency key',
  ADD COLUMN crm_first_login_at  DATETIME     NULL COMMENT 'First CRM login time, pushed back by CRM';

-- SSO tokens table for CRM-initiated reverse SSO (CRM calls Mall to issue a consume token)
CREATE TABLE IF NOT EXISTS mall_sso_tokens (
  id           INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  token_hash   VARCHAR(64)   NOT NULL UNIQUE COMMENT 'sha256(rawToken) hex',
  partner_id   INT UNSIGNED  NOT NULL,
  admin_email  VARCHAR(255)  NOT NULL COMMENT 'CRM admin who requested SSO',
  redirect_url VARCHAR(2000) NOT NULL DEFAULT '/',
  expires_at   DATETIME      NOT NULL,
  consumed_at  DATETIME      NULL,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_partner (partner_id),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
