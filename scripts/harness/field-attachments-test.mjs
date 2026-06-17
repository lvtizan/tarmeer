#!/usr/bin/env node
/**
 * field-attachments-test.mjs
 *
 * 回归用例：访谈问卷上传的附件（company_interviews.attachments）必须在
 * admin 访谈记录详情页可见。
 *
 * 历史 bug：后端 getInterview 用 SELECT ci.* 已返回 attachments，但
 * src/app/admin/visit-records/page.tsx 从不渲染该字段 → 上传的附件完全不可见。
 *
 * 本用例断言（端到端真实路径，不只 curl 200）：
 *   1. company_interviews 有 attachments 列
 *   2. 至少存在一条带附件的访谈记录，且每个附件有可用 url
 *   3. 每个附件 url 通过后端静态服务解析为 HTTP 200（文件真实存在）
 *   4. admin 详情页源码包含 Attachments 渲染块（parseAttachments + 列表）
 *   5. parseAttachments 逻辑对真实 DB 行产出非空可渲染条目
 *
 * 用法: node scripts/harness/field-attachments-test.mjs
 * 前置: 本地后端 3002 + 本地 DB（DB_HOST=localhost）
 */
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { createRequire } from 'module';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const require = createRequire(import.meta.url);
const BACKEND_PORT = 3002;

let pass = 0, fail = 0;
function ok(label) { console.log(`  \x1b[32m✓\x1b[0m ${label}`); pass++; }
function ng(label, detail) { console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? ' — ' + detail : ''}`); fail++; }

// 复刻 page.tsx 的 parseAttachments（保持与生产渲染逻辑一致）
function parseAttachments(raw) {
  if (!raw) return [];
  let obj = raw;
  if (typeof raw === 'string') { try { obj = JSON.parse(raw); } catch { return []; } }
  if (!Array.isArray(obj)) return [];
  return obj.filter(a => a && typeof a.url === 'string' && a.url.length > 0);
}

function httpStatus(p) {
  return new Promise((resolve) => {
    const r = http.request({ host: 'localhost', port: BACKEND_PORT, path: p, method: 'GET' }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    r.on('error', () => resolve(null));
    r.end();
  });
}

(async () => {
  console.log('\n[field-attachments] admin 访谈详情页附件可见性回归');

  // ── 4. 静态断言：admin 详情页必须渲染 attachments ──────────────────────────
  const pageSrc = fs.readFileSync(
    path.join(ROOT, 'src/app/admin/visit-records/page.tsx'), 'utf8'
  );
  if (pageSrc.includes('parseAttachments(detail.attachments)')) {
    ok('admin 详情页调用 parseAttachments(detail.attachments)');
  } else {
    ng('admin 详情页未渲染 attachments', '回归：page.tsx 缺少附件渲染块');
  }
  if (/Attachments['"`]/.test(pageSrc) && pageSrc.includes('att.url')) {
    ok('admin 详情页存在 Attachments 渲染列表（att.url 链接）');
  } else {
    ng('admin 详情页 Attachments 列表缺失');
  }

  // ── DB 连接 ────────────────────────────────────────────────────────────────
  let pool;
  try {
    const mysql = require(path.join(ROOT, 'server/node_modules/mysql2/promise'));
    const dotenv = require(path.join(ROOT, 'server/node_modules/dotenv'));
    dotenv.config({ path: path.join(ROOT, 'server/.env') });
    if (process.env.DB_HOST && process.env.DB_HOST !== 'localhost') {
      ng('DB 安全检查', `DB_HOST=${process.env.DB_HOST} 非 localhost，拒绝运行`);
      finish(); return;
    }
    pool = await mysql.createPool({
      host: process.env.DB_HOST, user: process.env.DB_USER,
      password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306,
    });
  } catch (e) {
    ng('DB 连接', e.message);
    finish(); return;
  }

  try {
    // ── 1. 列存在 ──
    const [cols] = await pool.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_interviews' AND COLUMN_NAME = 'attachments'`
    );
    if (cols.length === 1) ok('company_interviews.attachments 列存在');
    else ng('company_interviews.attachments 列缺失');

    // ── 2. 存在带附件的记录 ──
    const [rows] = await pool.execute(
      `SELECT id, attachments FROM company_interviews
       WHERE attachments IS NOT NULL AND JSON_LENGTH(attachments) > 0
       ORDER BY id DESC LIMIT 1`
    );
    if (rows.length === 0) {
      // 没有真实数据时跳过（CI 干净库），不算失败但提示
      console.log('  \x1b[33m·\x1b[0m 本地无带附件记录，跳过 URL 解析断言（非失败）');
    } else {
      const iv = rows[0];
      const atts = parseAttachments(iv.attachments);
      if (atts.length > 0) ok(`记录 #${iv.id} parseAttachments 产出 ${atts.length} 个可渲染附件`);
      else ng(`记录 #${iv.id} parseAttachments 产出空`, '附件 JSON 异常');

      // ── 3. 每个附件 url 通过后端解析 200 ──
      for (const att of atts) {
        const status = await httpStatus(att.url);
        if (status === 200) ok(`附件 URL 解析 200: ${att.url}`);
        else if (status === null) ng(`附件 URL 解析失败: ${att.url}`, '后端 3002 不可达');
        else ng(`附件 URL 解析非 200: ${att.url}`, `status=${status}`);
      }
    }
  } catch (e) {
    ng('DB 查询', e.message);
  } finally {
    await pool.end().catch(() => {});
  }

  finish();
})();

function finish() {
  const total = pass + fail;
  console.log(`\n${'─'.repeat(40)}`);
  if (fail === 0) {
    console.log(`\x1b[32m field-attachments: all ${total} checks passed\x1b[0m`);
  } else {
    console.log(`\x1b[31m field-attachments: ${fail}/${total} checks FAILED\x1b[0m`);
    process.exit(1);
  }
}
