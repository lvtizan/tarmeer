#!/usr/bin/env node
/**
 * partner-sync-walkthrough.mjs — 合作方同步入库层验收
 * 用法: node scripts/harness/partner-sync-walkthrough.mjs
 * 前提: 本地后端 localhost:3002 已启动；本地 MySQL tarmeer 库；已建 partner_* 表。
 */
import { execSync } from "child_process";
import crypto from "crypto";

const API = "http://localhost:3002/api/partner-sync";
const KEY = "harness-partner-key";
const SECRET = "harness-secret-123";
const TS = Date.now();
const MARK = `h${TS}`;

let pass = 0, fail = 0;
const ok = (l) => { console.log(`  \x1b[32m✓\x1b[0m ${l}`); pass++; };
const ng = (l, d) => { console.log(`  \x1b[31m✗\x1b[0m ${l}${d ? " — " + d : ""}`); fail++; };
const sql = (q) => execSync(`mysql -u root -proot123 tarmeer -N -e ${JSON.stringify(q)} 2>/dev/null`, { encoding: "utf8" }).trim();

// 准备：建测试 partner（先清残留）
sql("DELETE FROM partner_accounts WHERE partner_key='" + KEY + "'");
sql(`INSERT INTO partner_accounts (partner_key, secret, countries_json, default_lang) VALUES ('${KEY}','${SECRET}','[\\"ae\\",\\"vn\\"]','en')`);
const PARTNER_ID = sql("SELECT id FROM partner_accounts WHERE partner_key='" + KEY + "'");
const cleanup = () => {
  sql(`DELETE FROM partner_sync_products WHERE partner_id=${PARTNER_ID}`);
  sql(`DELETE FROM partner_sync_companies WHERE partner_id=${PARTNER_ID}`);
  sql(`DELETE FROM partner_sync_requests WHERE partner_id=${PARTNER_ID}`);
  sql(`DELETE FROM partner_accounts WHERE id=${PARTNER_ID}`);
};

async function call(method, path, bodyObj, { badSig = false } = {}) {
  const raw = bodyObj ? JSON.stringify(bodyObj) : "";
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = badSig ? "deadbeef" : crypto.createHmac("sha256", SECRET).update(`${ts}\n${raw}`).digest("hex");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "X-Partner-Key": KEY, "X-Timestamp": ts, "X-Signature": sig },
    body: bodyObj ? raw : undefined,
  });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}
const rid = (s) => `${MARK}-${s}`;
const prod = (ext, over = {}) => ({ external_id: ext, status: "active", title: { en: "Rope", vi: "Day" }, ...over });

try {
  console.log("合作方同步入库 walkthrough\n");

  // UC1 签名校验
  let r = await call("POST", "/products/create", { version: "1", request_id: rid("sig"), items: [prod(`${MARK}-p1`)] }, { badSig: true });
  r.status === 401 ? ok("UC1 错误签名 → 401") : ng("UC1 错误签名应 401", `got ${r.status}`);

  // UC2 创建幂等：同 external_id 推两次 → 一条，内容为最后一次
  await call("POST", "/products/create", { version: "1", request_id: rid("c1"), items: [prod(`${MARK}-p2`, { title: { en: "First" } })] });
  await call("POST", "/products/create", { version: "1", request_id: rid("c2"), items: [prod(`${MARK}-p2`, { title: { en: "Second" } })] });
  const cnt = sql(`SELECT COUNT(*) FROM partner_sync_products WHERE partner_id=${PARTNER_ID} AND external_id='${MARK}-p2'`);
  const title = sql(`SELECT JSON_EXTRACT(payload_json,'$.title.en') FROM partner_sync_products WHERE partner_id=${PARTNER_ID} AND external_id='${MARK}-p2'`);
  cnt === "1" && title.includes("Second") ? ok("UC2 同 external_id 幂等（一条，内容最新）") : ng("UC2 幂等失败", `cnt=${cnt} title=${title}`);

  // UC3 request_id 去重：同 request_id 重发 → 不重复处理
  const rd = rid("dedup");
  await call("POST", "/products/create", { version: "1", request_id: rd, items: [prod(`${MARK}-p3`, { title: { en: "v1" } })] });
  await call("POST", "/products/create", { version: "1", request_id: rd, items: [prod(`${MARK}-p3`, { title: { en: "v2-should-be-ignored" } })] });
  const t3 = sql(`SELECT JSON_EXTRACT(payload_json,'$.title.en') FROM partner_sync_products WHERE partner_id=${PARTNER_ID} AND external_id='${MARK}-p3'`);
  t3.includes("v1") ? ok("UC3 同 request_id 去重（第二次被忽略）") : ng("UC3 去重失败", `title=${t3}`);

  // UC4 容错拆分：create 遇已存在→updated；update 遇不存在→created
  let cr = await call("POST", "/products/create", { version: "1", request_id: rid("dup"), items: [prod(`${MARK}-p2`)] });
  let up = await call("POST", "/products/update", { version: "1", request_id: rid("new"), items: [prod(`${MARK}-p4new`)] });
  cr.body?.results?.[0]?.action === "updated" && up.body?.results?.[0]?.action === "created"
    ? ok("UC4 容错（create 遇存在=updated / update 遇缺失=created）")
    : ng("UC4 容错失败", JSON.stringify([cr.body?.results, up.body?.results]));

  // UC5 状态同步：下架 status=inactive → listing_status=inactive；再上架→active
  await call("POST", "/products/update", { version: "1", request_id: rid("off"), items: [prod(`${MARK}-p2`, { status: "inactive" })] });
  const ls1 = sql(`SELECT listing_status FROM partner_sync_products WHERE partner_id=${PARTNER_ID} AND external_id='${MARK}-p2'`);
  await call("POST", "/products/update", { version: "1", request_id: rid("on"), items: [prod(`${MARK}-p2`, { status: "active" })] });
  const ls2 = sql(`SELECT listing_status FROM partner_sync_products WHERE partner_id=${PARTNER_ID} AND external_id='${MARK}-p2'`);
  ls1 === "inactive" && ls2 === "active" ? ok("UC5 上下架状态同步") : ng("UC5 状态失败", `off=${ls1} on=${ls2}`);

  // UC6 部分失败：一条缺 title → 该条 ok:false，其余成功
  let pf = await call("POST", "/products/create", { version: "1", request_id: rid("pf"), items: [prod(`${MARK}-p5`), { external_id: `${MARK}-p6` }] });
  const rs = pf.body?.results || [];
  rs[0]?.ok === true && rs[1]?.ok === false ? ok("UC6 部分失败逐条返回，不整批回滚") : ng("UC6 部分失败处理错", JSON.stringify(rs));

  // UC7 多语言存储：{en,vi} 往返不丢
  await call("POST", "/products/create", { version: "1", request_id: rid("i18n"), items: [prod(`${MARK}-p7`, { title: { en: "Hello", vi: "Xin chao" } })] });
  const vi = sql(`SELECT JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.title.vi')) FROM partner_sync_products WHERE partner_id=${PARTNER_ID} AND external_id='${MARK}-p7'`);
  vi === "Xin chao" ? ok("UC7 多语言母本存储往返") : ng("UC7 多语言失败", `vi=${vi}`);

  // UC8 待审：新建商品 review_status=pending 且未发布（mapped_product_id 为空、不可见）
  let st = await call("GET", `/products/status?external_id=${MARK}-p7`, null);
  const rev = sql(`SELECT review_status FROM partner_sync_products WHERE partner_id=${PARTNER_ID} AND external_id='${MARK}-p7'`);
  rev === "pending" && st.body?.visible === false ? ok("UC8 新数据 pending 且未公开可见") : ng("UC8 待审失败", `rev=${rev} visible=${st.body?.visible} status=${st.status}`);

  // UC9 部分失败不缓存：同 request_id 修正后重推会重新处理（回归测试）
  const rr = rid("retryfix");
  let f1 = await call("POST", "/products/create", { version: "1", request_id: rr, items: [prod(`${MARK}-p9a`), { external_id: `${MARK}-p9b`, status: "active" }] });
  let f2 = await call("POST", "/products/create", { version: "1", request_id: rr, items: [prod(`${MARK}-p9a`), prod(`${MARK}-p9b`)] });
  const p9b = sql(`SELECT COUNT(*) FROM partner_sync_products WHERE partner_id=${PARTNER_ID} AND external_id='${MARK}-p9b'`);
  const f1ok = f1.body?.results?.[0]?.ok === true && f1.body?.results?.[1]?.ok === false;
  const f2ok = Array.isArray(f2.body?.results) && f2.body.results.every((x) => x.ok);
  f1ok && f2ok && p9b === "1" ? ok("UC9 部分失败不缓存，修正后重推可重处理") : ng("UC9 失败", `f1=${JSON.stringify(f1.body?.results)} f2=${JSON.stringify(f2.body?.results)} p9b=${p9b}`);

  console.log(`\n${pass} passed, ${fail} failed`);
} finally {
  cleanup();
}
process.exit(fail ? 1 : 0);
