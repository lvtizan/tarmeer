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
