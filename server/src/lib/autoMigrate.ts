/**
 * 自动数据库迁移 — 后端启动时自动检查并补齐缺失的字段/索引
 *
 * 设计原则：
 *   1. 幂等：重复执行不会报错（先检查再操作）
 *   2. 只增不删：只添加字段/索引，不删除任何现有结构
 *   3. 非阻塞：迁移失败只打日志，不影响服务启动
 */

import pool from '../config/database';

const TAG = '[auto-migrate]';

// ─── 迁移定义 ───────────────────────────────────────────

interface ColumnDef {
  table: string;
  column: string;
  type: string;       // e.g. "VARCHAR(255) NULL"
  unique?: boolean;    // 是否加唯一索引
}

interface IndexDef {
  table: string;
  indexName: string;
  columns: string;     // e.g. "google_id"
}

// 需要确保存在的表（CREATE TABLE IF NOT EXISTS）
const REQUIRED_TABLES: { name: string; sql: string }[] = [
  {
    name: 'admin_audit_log',
    sql: `CREATE TABLE IF NOT EXISTS admin_audit_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      admin_id INT NOT NULL,
      admin_name VARCHAR(100),
      action VARCHAR(50) NOT NULL,
      target_type VARCHAR(50) NOT NULL,
      target_ids JSON NOT NULL,
      reason TEXT,
      metadata JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_action (action),
      INDEX idx_created_at (created_at)
    )`,
  },
  {
    name: 'admin_last_seen',
    sql: `CREATE TABLE IF NOT EXISTS admin_last_seen (
      admin_id INT NOT NULL,
      page_key VARCHAR(50) NOT NULL,
      last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (admin_id, page_key)
    )`,
  },
  {
    name: 'weight_config',
    sql: `CREATE TABLE IF NOT EXISTS weight_config (
      id INT AUTO_INCREMENT PRIMARY KEY,
      config_key VARCHAR(50) NOT NULL UNIQUE,
      config_value INT NOT NULL,
      description VARCHAR(200),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  },
];

// 需要确保存在的字段
const REQUIRED_COLUMNS: ColumnDef[] = [
  // OAuth 相关
  { table: 'designers', column: 'google_id', type: 'VARCHAR(255) NULL', unique: true },
  { table: 'designers', column: 'facebook_id', type: 'VARCHAR(255) NULL', unique: true },
  { table: 'designers', column: 'oauth_provider', type: "ENUM('google','facebook') NULL" },
  { table: 'admin_users', column: 'reset_token', type: 'VARCHAR(255) NULL' },
  { table: 'admin_users', column: 'reset_token_expires', type: 'DATETIME NULL' },
  { table: 'uae_companies', column: 'display_order', type: 'INT NOT NULL DEFAULT 0' },
  { table: 'uae_companies', column: 'home_display_order', type: 'INT NOT NULL DEFAULT 0' },
  { table: 'uae_companies', column: 'list_display_order', type: 'INT NOT NULL DEFAULT 0' },
  { table: 'users', column: 'deleted_at', type: 'DATETIME NULL' },
  { table: 'users', column: 'deleted_by_admin_id', type: 'BIGINT NULL' },
  { table: 'users', column: 'delete_reason', type: 'VARCHAR(500) NULL' },
  { table: 'company_profiles', column: 'deleted_at', type: 'DATETIME NULL' },
  { table: 'company_profiles', column: 'deleted_by_admin_id', type: 'BIGINT NULL' },
  { table: 'company_profiles', column: 'delete_reason', type: 'VARCHAR(500) NULL' },
  { table: 'company_profiles', column: 'home_display_order', type: 'INT NOT NULL DEFAULT 0' },
  { table: 'company_profiles', column: 'list_display_order', type: 'INT NOT NULL DEFAULT 0' },

  // design_inquiries soft-delete + CRM sync
  { table: 'design_inquiries', column: 'deleted_at', type: 'DATETIME NULL' },
  { table: 'design_inquiries', column: 'deleted_by', type: 'INT NULL' },
  { table: 'design_inquiries', column: 'crm_synced_at', type: 'DATETIME NULL' },

  // projects soft-delete
  { table: 'projects', column: 'deleted_at', type: 'DATETIME NULL' },

  // Project slug for SEO-friendly URLs
  { table: 'projects', column: 'slug', type: 'VARCHAR(200) NULL' },

  // Slug for SEO-friendly URLs
  { table: 'company_profiles', column: 'slug', type: 'VARCHAR(200) NULL' },

  // Weight system
  { table: 'company_profiles', column: 'is_signed', type: 'TINYINT(1) DEFAULT 0' },
  { table: 'company_profiles', column: 'weight_score', type: 'INT DEFAULT 0' },
  { table: 'uae_companies', column: 'is_signed', type: 'TINYINT(1) DEFAULT 0' },
  { table: 'uae_companies', column: 'weight_score', type: 'INT DEFAULT 0' },

  // 以后新增字段在这里追加即可，例如：
  // { table: 'designers', column: 'wechat_id', type: 'VARCHAR(255) NULL' },
];

// 需要确保 NULL 的字段（OAuth 用户没有密码）
const NULLABLE_COLUMNS: { table: string; column: string; type: string }[] = [
  { table: 'designers', column: 'password', type: 'VARCHAR(255) NULL' },
];

// 需要确保存在的索引
const REQUIRED_INDEXES: IndexDef[] = [
  { table: 'designers', indexName: 'idx_oauth_google', columns: 'google_id' },
  { table: 'designers', indexName: 'idx_oauth_facebook', columns: 'facebook_id' },
];

// ─── 工具函数 ───────────────────────────────────────────

async function columnExists(table: string, column: string): Promise<boolean> {
  const [rows] = await pool.execute(
    'SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column]
  );
  return (rows as any[]).length > 0;
}

async function indexExists(table: string, indexName: string): Promise<boolean> {
  const [rows] = await pool.execute(
    'SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?',
    [table, indexName]
  );
  return (rows as any[]).length > 0;
}

async function isColumnNullable(table: string, column: string): Promise<boolean> {
  const [rows] = await pool.execute(
    'SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column]
  );
  const row = (rows as any[])[0];
  return row?.IS_NULLABLE === 'YES';
}

// ─── 主逻辑 ─────────────────────────────────────────────

export async function runAutoMigrate(): Promise<void> {
  console.log(`${TAG} Checking database schema...`);
  let changes = 0;

  try {
    // 0. 创建缺失的表
    for (const tbl of REQUIRED_TABLES) {
      await pool.execute(tbl.sql);
      console.log(`${TAG} Ensured table exists: ${tbl.name}`);
    }

    // 1. 添加缺失的字段
    for (const col of REQUIRED_COLUMNS) {
      const exists = await columnExists(col.table, col.column);
      if (!exists) {
        const uniqueStr = col.unique ? ' UNIQUE' : '';
        const sql = `ALTER TABLE ${col.table} ADD COLUMN ${col.column} ${col.type}${uniqueStr}`;
        await pool.execute(sql);
        console.log(`${TAG} Added column: ${col.table}.${col.column}`);
        changes++;
      }
    }

    // 2. 确保特定字段允许 NULL
    for (const col of NULLABLE_COLUMNS) {
      const exists = await columnExists(col.table, col.column);
      if (exists) {
        const nullable = await isColumnNullable(col.table, col.column);
        if (!nullable) {
          const sql = `ALTER TABLE ${col.table} MODIFY ${col.column} ${col.type}`;
          await pool.execute(sql);
          console.log(`${TAG} Modified column to nullable: ${col.table}.${col.column}`);
          changes++;
        }
      }
    }

    // 3. 添加缺失的索引
    for (const idx of REQUIRED_INDEXES) {
      const exists = await indexExists(idx.table, idx.indexName);
      if (!exists) {
        // 检查对应字段是否存在
        const colExists = await columnExists(idx.table, idx.columns);
        if (colExists) {
          const sql = `CREATE INDEX ${idx.indexName} ON ${idx.table}(${idx.columns})`;
          await pool.execute(sql);
          console.log(`${TAG} Added index: ${idx.indexName}`);
          changes++;
        }
      }
    }

    // 4. Populate slugs for existing company_profiles that don't have one
    try {
      await pool.execute(
        `UPDATE company_profiles SET slug = LOWER(REPLACE(REPLACE(REPLACE(TRIM(company_name), ' ', '-'), '.', ''), ',', '')) WHERE slug IS NULL OR slug = ''`
      );
    } catch { /* ignore if column doesn't exist yet */ }

    // 4b. Populate slugs for existing projects that don't have one
    try {
      await pool.execute(
        `UPDATE projects SET slug = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(title), ' ', '-'), '.', ''), ',', ''), '\'', '')) WHERE (slug IS NULL OR slug = '') AND title IS NOT NULL`
      );
    } catch { /* ignore if column doesn't exist yet */ }

    // 5. Seed weight_config defaults
    try {
      await pool.execute(
        `INSERT IGNORE INTO weight_config (config_key, config_value, description) VALUES
          ('base_profile_score', 50, '基础资料填完得分'),
          ('per_project_score', 10, '每个项目得分'),
          ('signed_score', 500, '签约公司加分')`
      );
    } catch { /* table may not exist yet */ }

    if (changes === 0) {
      console.log(`${TAG} Schema is up to date`);
    } else {
      console.log(`${TAG} Applied ${changes} migration(s)`);
    }
  } catch (error) {
    // 迁移失败不阻止服务启动
    console.error(`${TAG} Migration error (non-fatal):`, error);
  }
}
