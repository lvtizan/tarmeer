"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool = require("../config/database").default;
const { verify } = require("../lib/partnerSyncSignature");

const MAX_ITEMS = 100;

// 文本字段必须是「语言码→文本」对象，且至少一种语言有值
function langMapHasValue(v) {
  return v && typeof v === "object" && !Array.isArray(v) &&
    Object.values(v).some((x) => typeof x === "string" && x.trim());
}

// 鉴权中间件：按 X-Partner-Key 取 partner，用 req.rawBody 验签
async function authenticate(req, res, next) {
  try {
    const key = req.headers["x-partner-key"];
    const ts = req.headers["x-timestamp"];
    const sig = req.headers["x-signature"];
    if (!key) return res.status(401).json({ error: "missing X-Partner-Key" });
    const [rows] = await pool.execute(
      "SELECT * FROM partner_accounts WHERE partner_key = ? AND status = 'active'", [key]);
    const partner = rows[0];
    if (!partner) return res.status(401).json({ error: "unknown partner" });
    const rawBody = req.rawBody || JSON.stringify(req.body || {});
    if (!verify(partner.secret, ts, rawBody, sig)) {
      return res.status(401).json({ error: "invalid signature" });
    }
    req.partner = partner;
    next();
  } catch (e) {
    console.error("[partner-sync] auth error", e);
    res.status(500).json({ error: "internal error" });
  }
}

async function cachedResponse(requestId) {
  const [rows] = await pool.execute(
    "SELECT response_json FROM partner_sync_requests WHERE request_id = ?", [requestId]);
  if (!rows[0]) return null;
  const r = rows[0].response_json;
  return typeof r === "string" ? JSON.parse(r) : r;
}
async function recordRequest(partnerId, requestId, endpoint, response) {
  await pool.execute(
    "INSERT IGNORE INTO partner_sync_requests (request_id, partner_id, endpoint, response_json) VALUES (?,?,?,?)",
    [requestId, partnerId, endpoint, JSON.stringify(response)]);
}

// 容错 upsert：create 遇已存在当更新、update 遇缺失当创建（底层同一逻辑）
async function upsertProduct(partner, item) {
  const ext = item && item.external_id;
  if (!ext || typeof ext !== "string") return { external_id: ext || null, ok: false, error: "external_id required" };
  if (!langMapHasValue(item.title)) return { external_id: ext, ok: false, error: "title required (lang map)" };
  const listing = item.status === "inactive" ? "inactive" : "active";
  const payload = JSON.stringify(item);
  const [exist] = await pool.execute(
    "SELECT id FROM partner_sync_products WHERE partner_id = ? AND external_id = ?", [partner.id, ext]);
  if (exist[0]) {
    await pool.execute(
      "UPDATE partner_sync_products SET payload_json=?, listing_status=?, is_deleted=0, review_status=IF(review_status='rejected','pending',review_status), synced_at=NOW() WHERE id=?",
      [payload, listing, exist[0].id]);
    return { external_id: ext, ok: true, action: "updated", review_status: "pending" };
  }
  await pool.execute(
    "INSERT INTO partner_sync_products (partner_id, external_id, payload_json, listing_status, review_status) VALUES (?,?,?,?, 'pending')",
    [partner.id, ext, payload, listing]);
  return { external_id: ext, ok: true, action: "created", review_status: "pending" };
}

async function handleProducts(req, res) {
  try {
    const { version, request_id, items } = req.body || {};
    if (!version || !request_id) return res.status(400).json({ error: "version and request_id required" });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items required" });
    if (items.length > MAX_ITEMS) return res.status(400).json({ error: `max ${MAX_ITEMS} items per request` });
    const cached = await cachedResponse(request_id);
    if (cached) return res.json(cached);
    const results = [];
    for (const item of items) results.push(await upsertProduct(req.partner, item));
    const response = { results };
    await recordRequest(req.partner.id, request_id, "products", response);
    res.json(response);
  } catch (e) {
    console.error("[partner-sync] products error", e);
    res.status(500).json({ error: "internal error" });
  }
}

async function handleCompany(req, res) {
  try {
    const { version, request_id, company } = req.body || {};
    if (!version || !request_id) return res.status(400).json({ error: "version and request_id required" });
    if (!company || !langMapHasValue(company.company_name))
      return res.status(400).json({ error: "company.company_name required (lang map)" });
    const cached = await cachedResponse(request_id);
    if (cached) return res.json(cached);
    const payload = JSON.stringify(company);
    const [exist] = await pool.execute(
      "SELECT id FROM partner_sync_companies WHERE partner_id = ?", [req.partner.id]);
    let action;
    if (exist[0]) {
      await pool.execute(
        "UPDATE partner_sync_companies SET payload_json=?, review_status=IF(review_status='rejected','pending',review_status), synced_at=NOW() WHERE id=?",
        [payload, exist[0].id]);
      action = "updated";
    } else {
      await pool.execute(
        "INSERT INTO partner_sync_companies (partner_id, payload_json, review_status) VALUES (?,?, 'pending')",
        [req.partner.id, payload]);
      action = "created";
    }
    const response = { ok: true, action, review_status: "pending" };
    await recordRequest(req.partner.id, request_id, "company", response);
    res.json(response);
  } catch (e) {
    console.error("[partner-sync] company error", e);
    res.status(500).json({ error: "internal error" });
  }
}

async function handleReconcile(req, res) {
  try {
    const { version, request_id, external_ids } = req.body || {};
    if (!version || !request_id) return res.status(400).json({ error: "version and request_id required" });
    if (!Array.isArray(external_ids)) return res.status(400).json({ error: "external_ids array required" });
    const cached = await cachedResponse(request_id);
    if (cached) return res.json(cached);
    let r;
    if (external_ids.length === 0) {
      [r] = await pool.execute(
        "UPDATE partner_sync_products SET is_deleted=1 WHERE partner_id=? AND is_deleted=0", [req.partner.id]);
    } else {
      const ph = external_ids.map(() => "?").join(",");
      [r] = await pool.execute(
        `UPDATE partner_sync_products SET is_deleted=1 WHERE partner_id=? AND is_deleted=0 AND external_id NOT IN (${ph})`,
        [req.partner.id, ...external_ids]);
    }
    const response = { ok: true, marked_deleted: r.affectedRows };
    await recordRequest(req.partner.id, request_id, "reconcile", response);
    res.json(response);
  } catch (e) {
    console.error("[partner-sync] reconcile error", e);
    res.status(500).json({ error: "internal error" });
  }
}

async function handleStatus(req, res) {
  try {
    const ext = req.query.external_id;
    if (!ext) return res.status(400).json({ error: "external_id required" });
    const [rows] = await pool.execute(
      "SELECT external_id, review_status, listing_status, is_deleted, mapped_product_id FROM partner_sync_products WHERE partner_id=? AND external_id=?",
      [req.partner.id, ext]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: "not found" });
    res.json({
      external_id: row.external_id,
      review_status: row.review_status,
      listing_status: row.listing_status,
      visible: row.review_status === "approved" && row.listing_status === "active" && !row.is_deleted && !!row.mapped_product_id,
    });
  } catch (e) {
    console.error("[partner-sync] status error", e);
    res.status(500).json({ error: "internal error" });
  }
}

module.exports = { authenticate, handleProducts, handleCompany, handleReconcile, handleStatus };
