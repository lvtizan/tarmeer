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
  {
    name: 'company_leads',
    sql: `CREATE TABLE IF NOT EXISTS company_leads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      contact_name VARCHAR(100) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      company_name VARCHAR(200) NOT NULL,
      year_established VARCHAR(10),
      scope_of_business VARCHAR(500),
      lang VARCHAR(5) DEFAULT 'en',
      source_page VARCHAR(200),
      status ENUM('new','contacted','converted','rejected') DEFAULT 'new',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status (status),
      INDEX idx_created_at (created_at)
    )`,
  },
  {
    name: 'system_config',
    sql: `CREATE TABLE IF NOT EXISTS system_config (
      config_key VARCHAR(100) NOT NULL PRIMARY KEY,
      config_value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  },
  {
    name: 'articles',
    sql: `CREATE TABLE IF NOT EXISTS articles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_profile_id INT,
      title VARCHAR(500) NOT NULL,
      slug VARCHAR(500),
      content TEXT,
      excerpt VARCHAR(500),
      cover_image VARCHAR(500),
      tags JSON,
      status ENUM('draft','published') DEFAULT 'draft',
      seo_title VARCHAR(200),
      seo_description VARCHAR(300),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_company (company_profile_id),
      INDEX idx_status (status),
      INDEX idx_slug (slug),
      INDEX idx_created_at (created_at)
    )`,
  },
  {
    name: 'activity_log',
    sql: `CREATE TABLE IF NOT EXISTS activity_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      user_name VARCHAR(100),
      user_role VARCHAR(20),
      action VARCHAR(50) NOT NULL,
      target_type VARCHAR(50),
      target_id INT,
      target_name VARCHAR(200),
      description TEXT,
      ip VARCHAR(45),
      country VARCHAR(50),
      city VARCHAR(50),
      metadata JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_user_role (user_role),
      INDEX idx_action (action),
      INDEX idx_created_at (created_at),
      INDEX idx_target_type (target_type)
    )`,
  },
  {
    name: 'supplier_users',
    sql: `CREATE TABLE IF NOT EXISTS supplier_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255),
      full_name VARCHAR(100),
      phone VARCHAR(64),
      google_id VARCHAR(255) UNIQUE,
      avatar_url VARCHAR(500),
      email_verified TINYINT(1) DEFAULT 0,
      verification_token VARCHAR(255),
      verification_expires DATETIME,
      reset_token VARCHAR(255),
      reset_expires DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_email (email),
      INDEX idx_google_id (google_id)
    )`,
  },
  {
    name: 'supplier_profiles',
    sql: `CREATE TABLE IF NOT EXISTS supplier_profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      supplier_user_id INT NOT NULL UNIQUE,
      company_name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      logo_url VARCHAR(500),
      cover_image_url VARCHAR(500),
      origin ENUM('china','dubai') NOT NULL DEFAULT 'china',
      categories JSON,
      has_physical_store TINYINT(1) DEFAULT 0,
      store_address VARCHAR(500),
      store_lat DECIMAL(10,8),
      store_lng DECIMAL(11,8),
      google_maps_url VARCHAR(500),
      contact_phone VARCHAR(64),
      whatsapp VARCHAR(64),
      website VARCHAR(500),
      status ENUM('pending','approved','rejected') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_supplier_user (supplier_user_id),
      INDEX idx_slug (slug),
      INDEX idx_status (status),
      INDEX idx_origin (origin)
    )`,
  },
  {
    name: 'supplier_products',
    sql: `CREATE TABLE IF NOT EXISTS supplier_products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      supplier_profile_id INT NOT NULL,
      title VARCHAR(255),
      description TEXT,
      image_url VARCHAR(500) NOT NULL,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_supplier (supplier_profile_id)
    )`,
  },
  {
    name: 'supplier_catalogs',
    sql: `CREATE TABLE IF NOT EXISTS supplier_catalogs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      supplier_profile_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      file_url VARCHAR(500) NOT NULL,
      file_size INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_supplier (supplier_profile_id)
    )`,
  },
  {
    name: 'supplier_leads',
    sql: `CREATE TABLE IF NOT EXISTS supplier_leads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      contact_name VARCHAR(100) NOT NULL,
      phone VARCHAR(64) NOT NULL,
      company_name VARCHAR(200),
      category VARCHAR(100),
      origin ENUM('china','dubai'),
      message TEXT,
      source_page VARCHAR(200),
      status ENUM('new','contacted','converted','rejected') DEFAULT 'new',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status (status),
      INDEX idx_created_at (created_at)
    )`,
  },
  {
    name: 'company_interviews',
    sql: `CREATE TABLE IF NOT EXISTS company_interviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      interviewer_id INT NOT NULL,
      company_ref_id INT NULL,
      company_name VARCHAR(200) NOT NULL DEFAULT '',
      status ENUM('draft', 'submitted') NOT NULL DEFAULT 'draft',
      section_1 JSON NULL,
      section_2 JSON NULL,
      section_3 JSON NULL,
      section_4 JSON NULL,
      section_5 JSON NULL,
      section_6 JSON NULL,
      section_7 JSON NULL,
      section_8 JSON NULL,
      section_9 JSON NULL,
      submitted_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_interviewer (interviewer_id),
      INDEX idx_status (status),
      INDEX idx_company_ref (company_ref_id)
    )`,
  },
  {
    name: 'rejection_templates',
    sql: `CREATE TABLE IF NOT EXISTS rejection_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      admin_id INT NOT NULL,
      text TEXT NOT NULL,
      use_count INT NOT NULL DEFAULT 1,
      last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_admin_text (admin_id, text(500))
    )`,
  },
  {
    name: 'company_types',
    sql: `CREATE TABLE IF NOT EXISTS company_types (
      slug VARCHAR(50) NOT NULL PRIMARY KEY,
      label VARCHAR(100) NOT NULL,
      sort_order INT DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    name: 'company_services',
    sql: `CREATE TABLE IF NOT EXISTS company_services (
      name VARCHAR(100) NOT NULL PRIMARY KEY,
      sort_order INT DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
  { table: 'company_leads', column: 'company_type', type: 'VARCHAR(100) NULL' },
  { table: 'company_leads', column: 'city', type: 'VARCHAR(100) NULL' },
  { table: 'company_leads', column: 'email', type: 'VARCHAR(255) NULL' },

  // design_inquiries soft-delete + CRM sync
  { table: 'design_inquiries', column: 'deleted_at', type: 'DATETIME NULL' },
  { table: 'design_inquiries', column: 'deleted_by', type: 'INT NULL' },
  { table: 'design_inquiries', column: 'crm_synced_at', type: 'DATETIME NULL' },
  // CRM sync: richer status tracking so we can surface failures + retry manually.
  // status: pending (not yet attempted) / synced / failed
  // crm_lead_id: CRM's Lead UUID returned in data.leadId
  // crm_action: created / linked / updated / duplicate — matches CRM inbound contract
  // crm_last_error: JSON-serialized error payload (httpStatus, code, message) on failure
  // crm_sync_attempts: incremented on every push attempt
  { table: 'design_inquiries', column: 'crm_sync_status', type: "ENUM('pending','synced','failed') NOT NULL DEFAULT 'pending'" },
  { table: 'design_inquiries', column: 'crm_lead_id', type: 'VARCHAR(64) NULL' },
  { table: 'design_inquiries', column: 'crm_action', type: 'VARCHAR(32) NULL' },
  { table: 'design_inquiries', column: 'crm_last_error', type: 'TEXT NULL' },
  { table: 'design_inquiries', column: 'crm_sync_attempts', type: 'INT NOT NULL DEFAULT 0' },

  // projects soft-delete
  { table: 'projects', column: 'deleted_at', type: 'DATETIME NULL' },

  // Project slug for SEO-friendly URLs
  { table: 'projects', column: 'slug', type: 'VARCHAR(200) NULL' },

  // Project tags for filtering (JSON array: ["Living Room", "Modern", ...])
  { table: 'projects', column: 'tags', type: 'JSON NULL' },

  // Slug for SEO-friendly URLs
  { table: 'company_profiles', column: 'slug', type: 'VARCHAR(200) NULL' },

  // Weight system
  { table: 'company_profiles', column: 'is_signed', type: 'TINYINT(1) DEFAULT 0' },
  { table: 'company_profiles', column: 'weight_score', type: 'INT DEFAULT 0' },
  { table: 'uae_companies', column: 'is_signed', type: 'TINYINT(1) DEFAULT 0' },
  { table: 'uae_companies', column: 'weight_score', type: 'INT DEFAULT 0' },

  // User permissions (JSON array of permission strings)
  { table: 'users', column: 'permissions', type: 'JSON NULL' },

  // YouTube / external video link per project
  { table: 'projects', column: 'video_url', type: 'VARCHAR(500) NULL' },

  // Company onboarding wizard step tracker
  { table: 'company_profiles', column: 'onboarding_step', type: 'TINYINT DEFAULT 0' },

  // Admin-pinned cover image (URL of a portfolio photo to use as company list/detail cover).
  // NULL = fallback to portfolio_images[0].
  { table: 'company_profiles', column: 'cover_image_url', type: 'VARCHAR(1024) NULL' },

  // Supplier display order (lower = earlier in public listing)
  { table: 'supplier_profiles', column: 'sort_order', type: 'INT NOT NULL DEFAULT 0' },

  // Supplier business license upload
  { table: 'supplier_profiles', column: 'license_url', type: 'VARCHAR(500) NULL' },
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

    // 6. Seed company_types from hardcoded list
    try {
      await pool.execute(
        `INSERT IGNORE INTO company_types (slug, label, sort_order) VALUES
          ('design_studio',      'Design Studio',        1),
          ('renovation_company', 'Renovation Company',   2),
          ('general_contractor', 'General Contractor',   3),
          ('fitout_contractor',  'Fit-Out Contractor',   4),
          ('mep_contractor',     'MEP Contractor',       5),
          ('maintenance_company','Maintenance Company',  6),
          ('specialty_trade',    'Specialty Trade',      7),
          ('landscaping',        'Landscaping',          8),
          ('furnishing',         'Furnishing',           9),
          ('glass_aluminium',    'Glass & Aluminium',   10),
          ('waterproofing',      'Waterproofing',       11),
          ('smart_home',         'Smart Home',          12),
          ('fire_fighting',      'Fire Fighting',       13),
          ('carpentry_joinery',  'Carpentry & Joinery', 14),
          ('stone_marble',       'Stone & Marble',      15),
          ('steel_fabrication',  'Steel Fabrication',   16),
          ('cleaning_services',  'Cleaning Services',   17),
          ('manpower_supply',    'Manpower Supply',     18),
          ('swimming_pool',      'Swimming Pool',       19)`
      );
    } catch { /* table may not exist yet */ }

    // 7. Seed company_services from hardcoded list
    try {
      await pool.execute(
        `INSERT IGNORE INTO company_services (name, sort_order) VALUES
          ('Interior Design',          1),
          ('Architecture',             2),
          ('Fit-Out',                  3),
          ('Renovation',               4),
          ('Construction',             5),
          ('Landscape',                6),
          ('Furniture',                7),
          ('Joinery',                  8),
          ('MEP',                      9),
          ('Project Management',      10),
          ('Design & Build',          11),
          ('Turnkey Solutions',        12),
          ('Maintenance',             13),
          ('Glass & Aluminium',       14),
          ('Painting & Finishing',    15),
          ('Flooring & Tiling',       16),
          ('Demolition',              17),
          ('Steel & Fabrication',     18),
          ('Curtains & Blinds',       19),
          ('Cleaning Services',       20),
          ('Pools',                   21),
          ('HVAC & Ducting',          22),
          ('Fire Fighting',           23),
          ('Smart Home & Automation', 24),
          ('Waterproofing',           25),
          ('Solar Systems',           26),
          ('Epoxy & PU Flooring',     27),
          ('Scaffolding',             28),
          ('Lighting Installation',   29),
          ('Stone & Marble Fixing',   30),
          ('Gypsum & Partitions',     31),
          ('Deep Cleaning',           32)`
      );
    } catch { /* table may not exist yet */ }

    // 8. Add field_staff role to admin_users ENUM
    await addFieldStaffRole();

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

async function addFieldStaffRole() {
  try {
    const [cols] = await pool.execute(`
      SELECT COLUMN_TYPE FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'admin_users'
        AND COLUMN_NAME = 'role'
    `);
    const colType = (cols as any[])[0]?.COLUMN_TYPE || '';
    if (!colType.includes('field_staff')) {
      await pool.execute(`
        ALTER TABLE admin_users
        MODIFY COLUMN role ENUM('super_admin','sub_admin','field_staff') NOT NULL DEFAULT 'super_admin'
      `);
      console.log(`${TAG} Added field_staff to admin_users.role ENUM`);
    }
  } catch (e) {
    console.error(`${TAG} Failed to add field_staff role:`, e);
  }
}
