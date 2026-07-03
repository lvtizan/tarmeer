#!/usr/bin/env node
/**
 * partner-sync-multisupplier.mjs — 多供应商支持验收
 * 证明：同一 partner 可有多家企业，各自按 supplier_id 分组；商品落到各自匹配的供应商。
 * 用法: node scripts/harness/partner-sync-multisupplier.mjs
 * 前提: 本地后端 localhost:3002 已启动；本地 MySQL tarmeer 库；partner-multi-supplier-schema.sql 已应用。
 */
import { execSync } from "child_process";
import crypto from "crypto";

const API = "http://localhost:3002/api";
const KEY = "harness-ms-key", SECRET = "harness-ms-secret";
const TS = Date.now(), MARK = `ms${TS}`;
let pass = 0, fail = 0;
const ok = (l) => { console.log(`  \x1b[32m✓\x1b[0m ${l}`); pass++; };
const ng = (l, d) => { console.log(`  \x1b[31m✗\x1b[0m ${l}${d ? " — " + d : ""}`); fail++; };
const sql = (q) => execSync(`mysql -u root -proot123 tarmeer -N -e ${JSON.stringify(q)} 2>/dev/null`, { encoding: "utf8" }).trim();

// 建测试 partner（仅 ae，简化断言）
sql("DELETE FROM partner_accounts WHERE partner_key='" + KEY + "'");
sql(`INSERT INTO partner_accounts (partner_key, secret, countries_json, default_lang) VALUES ('${KEY}','${SECRET}','[\\"ae\\"]','en')`);
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
  const res = await fetch(`${API}/partner-sync${path}`, {
    method,
    headers: { "Content-Type": "application/json", "X-Partner-Key": KEY, "X-Timestamp": ts, "X-Signature": sig },
    body: body ? raw : undefined,
  });
  let j = null; try { j = await res.json(); } catch {}
  return { status: res.status, body: j };
}

async function adminToken() {
  const r = await fetch(`${API}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "harness-test@tarmeer.local", password: "Harness#Local123" }),
  });
  const j = await r.json(); return j.token || j.accessToken;
}

async function admin(method, path, token) {
  const r = await fetch(`${API}/admin${path}`, { method, headers: { Authorization: `Bearer ${token}` } });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
}

try {
  console.log("多供应商支持 walkthrough\n");

  const token = await adminToken();
  if (!token) { ng("无法取得 admin token"); throw new Error("no admin token"); }

  // --- 推送企业 A（SUP-A）---
  const coA = await sync("POST", "/company", {
    version: "1", request_id: `${MARK}-coA`,
    company: {
      company_name: { en: "Seller Alpha" },
      attributes: { supplier_id: "SUP-A" },
    },
  });
  coA.status === 200 && coA.body?.ok ? ok("UC1 企业 A (SUP-A) 推送成功") : ng("UC1 企业 A 推送失败", JSON.stringify(coA.body));

  // --- 推送企业 B（SUP-B）---
  const coB = await sync("POST", "/company", {
    version: "1", request_id: `${MARK}-coB`,
    company: {
      company_name: { en: "Seller Beta" },
      attributes: { supplier_id: "SUP-B" },
    },
  });
  coB.status === 200 && coB.body?.ok ? ok("UC2 企业 B (SUP-B) 推送成功") : ng("UC2 企业 B 推送失败", JSON.stringify(coB.body));

  // --- 验证 staging 有 2 行（未合并覆盖）---
  const companyCnt = sql(`SELECT COUNT(*) FROM partner_sync_companies WHERE partner_id=${PID}`);
  companyCnt === "2" ? ok("UC3 partner_sync_companies 有 2 行（未覆盖）") : ng("UC3 企业行数错", `got ${companyCnt}`);

  // --- 推送商品 (SUP-A)---
  const prodA = await sync("POST", "/products/create", {
    version: "1", request_id: `${MARK}-pA`,
    items: [{
      external_id: `${MARK}-sku-A`,
      status: "active",
      title: { en: "Product Alpha" },
      attributes: { supplier_id: "SUP-A" },
      images: [],
    }],
  });
  prodA.body?.results?.[0]?.ok ? ok("UC4 商品 A (SUP-A) 推送成功") : ng("UC4 商品 A 推送失败", JSON.stringify(prodA.body));

  // --- 推送商品 (SUP-B)---
  const prodB = await sync("POST", "/products/create", {
    version: "1", request_id: `${MARK}-pB`,
    items: [{
      external_id: `${MARK}-sku-B`,
      status: "active",
      title: { en: "Product Beta" },
      attributes: { supplier_id: "SUP-B" },
      images: [],
    }],
  });
  prodB.body?.results?.[0]?.ok ? ok("UC5 商品 B (SUP-B) 推送成功") : ng("UC5 商品 B 推送失败", JSON.stringify(prodB.body));

  // 验证商品 supplier_ref 正确存储
  const refA = sql(`SELECT supplier_ref FROM partner_sync_products WHERE partner_id=${PID} AND external_id='${MARK}-sku-A'`);
  const refB = sql(`SELECT supplier_ref FROM partner_sync_products WHERE partner_id=${PID} AND external_id='${MARK}-sku-B'`);
  refA === "SUP-A" && refB === "SUP-B" ? ok("UC6 商品 supplier_ref 正确存储") : ng("UC6 supplier_ref 错", `A=${refA} B=${refB}`);

  // --- Admin 审核两家企业 ---
  const companyAId = sql(`SELECT id FROM partner_sync_companies WHERE partner_id=${PID} AND supplier_ref='SUP-A'`);
  const companyBId = sql(`SELECT id FROM partner_sync_companies WHERE partner_id=${PID} AND supplier_ref='SUP-B'`);

  const apCoA = await admin("POST", `/partner-sync/companies/${companyAId}/approve`, token);
  const apCoB = await admin("POST", `/partner-sync/companies/${companyBId}/approve`, token);
  apCoA.status === 200 && apCoB.status === 200 ? ok("UC7 两家企业审核通过") : ng("UC7 企业审核失败", `A:${apCoA.status} B:${apCoB.status}`);

  // 审核后应出现 2 个独立 supplier_profiles
  const supplierCnt = sql(`SELECT COUNT(*) FROM supplier_profiles WHERE source='partner' AND partner_id=${PID} AND country='ae'`);
  supplierCnt === "2" ? ok("UC8 AE 产生 2 个独立 supplier_profiles") : ng("UC8 supplier_profiles 行数错", `got ${supplierCnt}`);

  // 验证两家 supplier_profiles 名字各自正确
  const nameA = sql(`SELECT company_name FROM supplier_profiles WHERE source='partner' AND partner_id=${PID} AND partner_supplier_ref='SUP-A' AND country='ae'`);
  const nameB = sql(`SELECT company_name FROM supplier_profiles WHERE source='partner' AND partner_id=${PID} AND partner_supplier_ref='SUP-B' AND country='ae'`);
  nameA === "Seller Alpha" && nameB === "Seller Beta" ? ok("UC9 两家供应商名称正确区分") : ng("UC9 供应商名称错", `A=${nameA} B=${nameB}`);

  // --- Admin 审核两件商品 ---
  const stagingAId = sql(`SELECT id FROM partner_sync_products WHERE partner_id=${PID} AND external_id='${MARK}-sku-A'`);
  const stagingBId = sql(`SELECT id FROM partner_sync_products WHERE partner_id=${PID} AND external_id='${MARK}-sku-B'`);

  const apProdA = await admin("POST", `/partner-sync/products/${stagingAId}/approve`, token);
  const apProdB = await admin("POST", `/partner-sync/products/${stagingBId}/approve`, token);
  apProdA.status === 200 && apProdB.status === 200 ? ok("UC10 两件商品审核通过") : ng("UC10 商品审核失败", `A:${apProdA.status} B:${apProdB.status}`);

  // 验证商品落到各自匹配的供应商（Product Alpha → Seller Alpha）
  const supplierOfA = sql(`SELECT sp.company_name FROM supplier_products p JOIN supplier_profiles sp ON sp.id=p.supplier_profile_id WHERE sp.partner_id=${PID} AND sp.country='ae' AND p.partner_external_id='${MARK}-sku-A'`);
  const supplierOfB = sql(`SELECT sp.company_name FROM supplier_products p JOIN supplier_profiles sp ON sp.id=p.supplier_profile_id WHERE sp.partner_id=${PID} AND sp.country='ae' AND p.partner_external_id='${MARK}-sku-B'`);
  supplierOfA === "Seller Alpha" && supplierOfB === "Seller Beta" ? ok("UC11 商品归属各自匹配供应商（未混桶）") : ng("UC11 商品归属错", `A→${supplierOfA} B→${supplierOfB}`);

  // 验证两家 supplier_profiles 的 slug 不同（无碰撞）
  const slugA = sql(`SELECT slug FROM supplier_profiles WHERE source='partner' AND partner_id=${PID} AND partner_supplier_ref='SUP-A' AND country='ae'`);
  const slugB = sql(`SELECT slug FROM supplier_profiles WHERE source='partner' AND partner_id=${PID} AND partner_supplier_ref='SUP-B' AND country='ae'`);
  slugA && slugB && slugA !== slugB ? ok("UC12 两家供应商 slug 唯一不碰撞") : ng("UC12 slug 碰撞或为空", `A=${slugA} B=${slugB}`);

  // 幂等：再次推送企业 A 同一 supplier_ref → 更新而非新增
  await sync("POST", "/company", {
    version: "1", request_id: `${MARK}-coA-v2`,
    company: { company_name: { en: "Seller Alpha v2" }, attributes: { supplier_id: "SUP-A" } },
  });
  const companyCntAfterUpdate = sql(`SELECT COUNT(*) FROM partner_sync_companies WHERE partner_id=${PID}`);
  const nameAUpdated = sql(`SELECT JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.company_name.en')) FROM partner_sync_companies WHERE partner_id=${PID} AND supplier_ref='SUP-A'`);
  companyCntAfterUpdate === "2" && nameAUpdated === "Seller Alpha v2" ? ok("UC13 同 supplier_ref 重推→更新，行数不增") : ng("UC13 幂等失败", `cnt=${companyCntAfterUpdate} name=${nameAUpdated}`);

  // UC14（Fix A）：企业审核通过后再推更新 → 退回 pending 供复审（auto_approve_updates=0）。
  // A 在 UC7 已通过、UC13 又重推，此刻应回到 pending。
  const statusAAfterRepush = sql(`SELECT review_status FROM partner_sync_companies WHERE partner_id=${PID} AND supplier_ref='SUP-A'`);
  statusAAfterRepush === "pending" ? ok("UC14 已通过企业被更新后退回 pending 复审") : ng("UC14 更新未退回 pending", `status=${statusAAfterRepush}`);

  // UC15（Fix B）：企业已通过、但其分组下有待审商品时，审核接口仍带出该企业作上下文。
  // 企业 B 保持 approved（不再推），仅给它推一件新的待审商品。
  await sync("POST", "/products/create", {
    version: "1", request_id: `${MARK}-pB2`,
    items: [{ external_id: `${MARK}-sku-B2`, status: "active", title: { en: "Product Beta 2" }, attributes: { supplier_id: "SUP-B" }, images: [] }],
  });
  const statusB = sql(`SELECT review_status FROM partner_sync_companies WHERE partner_id=${PID} AND supplier_ref='SUP-B'`);
  const listResp = await admin("GET", `/partner-sync/companies?country=ae`, token);
  const hasBInList = Array.isArray(listResp.body?.items) && listResp.body.items.some((c) => c.supplier_ref === "SUP-B");
  statusB === "approved" && hasBInList
    ? ok("UC15 已通过企业+待审商品→审核接口带出企业作上下文")
    : ng("UC15 未带出上下文企业", `B状态=${statusB} 在列表=${hasBInList}`);

  console.log(`\n${pass} passed, ${fail} failed`);
} finally {
  cleanup();
}
process.exit(fail ? 1 : 0);
