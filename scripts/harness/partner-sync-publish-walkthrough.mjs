#!/usr/bin/env node
/**
 * 合作方发布/扇出验收。前提：后端 3002 起；partner_* 与 supplier 表改动已就绪；
 * admin 测试号 harness-test@tarmeer.local / Harness#Local123。
 */
import { execSync } from "child_process";
import crypto from "crypto";

const API = "http://localhost:3002/api";
const KEY = "harness-pub-key", SECRET = "harness-pub-secret";
const TS = Date.now(), MARK = `pub${TS}`;
let pass = 0, fail = 0;
const ok = (l) => { console.log(`  \x1b[32m✓\x1b[0m ${l}`); pass++; };
const ng = (l, d) => { console.log(`  \x1b[31m✗\x1b[0m ${l}${d ? " — " + d : ""}`); fail++; };
const sql = (q) => execSync(`mysql -u root -proot123 tarmeer -N -e ${JSON.stringify(q)} 2>/dev/null`, { encoding: "utf8" }).trim();

sql("DELETE FROM partner_accounts WHERE partner_key='" + KEY + "'");
sql(`INSERT INTO partner_accounts (partner_key, secret, countries_json, default_lang) VALUES ('${KEY}','${SECRET}','[\\"ae\\",\\"vn\\"]','en')`);
const PID = sql("SELECT id FROM partner_accounts WHERE partner_key='" + KEY + "'");
const cleanup = () => {
  const sids = sql(`SELECT id FROM supplier_profiles WHERE source='partner' AND partner_id=${PID}`).split(/\s+/).filter(Boolean);
  for (const sid of sids) sql(`DELETE FROM supplier_products WHERE supplier_profile_id=${sid}`);
  sql(`DELETE FROM supplier_profiles WHERE source='partner' AND partner_id=${PID}`);
  sql(`DELETE FROM partner_sync_products WHERE partner_id=${PID}`);
  sql(`DELETE FROM partner_sync_companies WHERE partner_id=${PID}`);
  sql(`DELETE FROM partner_sync_requests WHERE partner_id=${PID}`);
  sql(`DELETE FROM partner_accounts WHERE id=${PID}`);
};

async function sync(method, path, body) {
  const raw = body ? JSON.stringify(body) : "";
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = crypto.createHmac("sha256", SECRET).update(`${ts}\n${raw}`).digest("hex");
  const res = await fetch(`${API}/partner-sync${path}`, { method, headers: { "Content-Type": "application/json", "X-Partner-Key": KEY, "X-Timestamp": ts, "X-Signature": sig }, body: body ? raw : undefined });
  let j = null; try { j = await res.json(); } catch {} return { status: res.status, body: j };
}
async function adminToken() {
  const r = await fetch(`${API}/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "harness-test@tarmeer.local", password: "Harness#Local123" }) });
  const j = await r.json(); return j.token || j.accessToken;
}
async function admin(method, path, token) {
  const r = await fetch(`${API}/admin${path}`, { method, headers: { Authorization: `Bearer ${token}` } });
  let j = null; try { j = await r.json(); } catch {} return { status: r.status, body: j };
}

try {
  console.log("合作方发布/扇出 walkthrough\n");
  const token = await adminToken();
  if (!token) { ng("无法取得 admin token"); throw new Error("no admin token"); }

  await sync("POST", "/company", { version: "1", request_id: `${MARK}-co`, default_lang: "en",
    company: { company_name: { en: "Acme Wholesale", vi: "Acme Si" }, description: { en: "d", vi: "d-vi" } } });
  await sync("POST", "/products/create", { version: "1", request_id: `${MARK}-p`, default_lang: "en",
    items: [{ external_id: `${MARK}-sku1`, status: "active", title: { en: "Blue Rope", vi: "Day Xanh" }, images: [] }] });
  const stagingId = sql(`SELECT id FROM partner_sync_products WHERE partner_id=${PID} AND external_id='${MARK}-sku1'`);
  const companyStagingId = sql(`SELECT id FROM partner_sync_companies WHERE partner_id=${PID}`);

  const before = sql(`SELECT COUNT(*) FROM supplier_profiles WHERE source='partner' AND partner_id=${PID}`);
  before === "0" ? ok("UC1 审核前无 live 供应商") : ng("UC1 审核前应无 live", `got ${before}`);

  await admin("POST", `/partner-sync/companies/${companyStagingId}/approve`, token);
  const ap = await admin("POST", `/partner-sync/products/${stagingId}/approve`, token);
  ap.status === 200 ? ok("UC2 审核商品返回 200") : ng("UC2 审核失败", `status ${ap.status}`);

  const supCnt = sql(`SELECT COUNT(*) FROM supplier_profiles WHERE source='partner' AND partner_id=${PID}`);
  supCnt === "2" ? ok("UC3 扇出成 AE+VN 两个供应商") : ng("UC3 供应商行数应为2", `got ${supCnt}`);

  const aeName = sql(`SELECT company_name FROM supplier_profiles WHERE source='partner' AND partner_id=${PID} AND country='ae'`);
  const vnName = sql(`SELECT company_name FROM supplier_profiles WHERE source='partner' AND partner_id=${PID} AND country='vn'`);
  aeName === "Acme Wholesale" && vnName === "Acme Si" ? ok("UC4 供应商名按国家取对语言") : ng("UC4 语言错", `ae=${aeName} vn=${vnName}`);

  const aeTitle = sql(`SELECT p.title FROM supplier_products p JOIN supplier_profiles s ON s.id=p.supplier_profile_id WHERE s.partner_id=${PID} AND s.country='ae' AND p.partner_external_id='${MARK}-sku1'`);
  const vnTitle = sql(`SELECT p.title FROM supplier_products p JOIN supplier_profiles s ON s.id=p.supplier_profile_id WHERE s.partner_id=${PID} AND s.country='vn' AND p.partner_external_id='${MARK}-sku1'`);
  aeTitle === "Blue Rope" && vnTitle === "Day Xanh" ? ok("UC5 商品标题按国家取对语言，不串语言") : ng("UC5 商品语言错", `ae=${aeTitle} vn=${vnTitle}`);

  const img = sql(`SELECT image_url FROM supplier_products p JOIN supplier_profiles s ON s.id=p.supplier_profile_id WHERE s.partner_id=${PID} AND s.country='ae' AND p.partner_external_id='${MARK}-sku1'`);
  img === "/images/partner/placeholder.webp" ? ok("UC6 无图商品用占位图") : ng("UC6 占位图错", `img=${img}`);

  const vis = sql(`SELECT COUNT(*) FROM supplier_profiles WHERE source='partner' AND partner_id=${PID} AND status='approved' AND is_published=1`);
  vis === "2" ? ok("UC7 供应商 approved+published 可见") : ng("UC7 可见性错", `got ${vis}`);

  await sync("POST", "/products/update", { version: "1", request_id: `${MARK}-off`, default_lang: "en",
    items: [{ external_id: `${MARK}-sku1`, status: "inactive", title: { en: "Blue Rope" } }] });
  await admin("POST", `/partner-sync/products/${stagingId}/approve`, token);
  const liveAfterOff = sql(`SELECT COUNT(*) FROM supplier_products p JOIN supplier_profiles s ON s.id=p.supplier_profile_id WHERE s.partner_id=${PID} AND p.partner_external_id='${MARK}-sku1'`);
  liveAfterOff === "0" ? ok("UC8 下架后 live 商品行被删（供应商仍在）") : ng("UC8 下架未删行", `got ${liveAfterOff}`);

  await sync("POST", "/products/update", { version: "1", request_id: `${MARK}-on`, default_lang: "en",
    items: [{ external_id: `${MARK}-sku1`, status: "active", title: { en: "Blue Rope" } }] });
  await admin("POST", `/partner-sync/products/${stagingId}/approve`, token);
  const liveOn = sql(`SELECT COUNT(*) FROM supplier_products p JOIN supplier_profiles s ON s.id=p.supplier_profile_id WHERE s.partner_id=${PID} AND p.partner_external_id='${MARK}-sku1'`);
  await admin("POST", `/partner-sync/products/${stagingId}/reject`, token);
  const liveRej = sql(`SELECT COUNT(*) FROM supplier_products p JOIN supplier_profiles s ON s.id=p.supplier_profile_id WHERE s.partner_id=${PID} AND p.partner_external_id='${MARK}-sku1'`);
  liveOn === "2" && liveRej === "0" ? ok("UC9 reject 撤下所有国家 live 行") : ng("UC9 reject 错", `on=${liveOn} rej=${liveRej}`);

  console.log(`\n${pass} passed, ${fail} failed`);
} finally { cleanup(); }
process.exit(fail ? 1 : 0);
