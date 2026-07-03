"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool = require("../config/database").default;
const publish = require("../lib/partnerPublishService");
const images = require("../lib/partnerImageService");

async function loadPartner(partnerId) {
  const [rows] = await pool.execute("SELECT * FROM partner_accounts WHERE id=?", [partnerId]);
  return rows[0] || null;
}

// GET /api/admin/partner-sync/products?status=pending&country=ae
async function listPendingProducts(req, res) {
  try {
    const status = req.query.status || "pending";
    const country = req.query.country;
    let sql = "SELECT p.id, p.partner_id, a.partner_key, p.external_id, p.supplier_ref, p.payload_json, p.review_status, p.listing_status, p.is_deleted, p.synced_at FROM partner_sync_products p JOIN partner_accounts a ON a.id=p.partner_id WHERE p.review_status=?";
    const args = [status];
    if (country) { sql += " AND JSON_CONTAINS(a.countries_json, JSON_QUOTE(?))"; args.push(country); }
    sql += " ORDER BY p.synced_at DESC LIMIT 200";
    const [rows] = await pool.execute(sql, args);
    res.json({ items: rows });
  } catch (e) { console.error("[partner-admin] list products error", e); res.status(500).json({ error: "internal error" }); }
}

// GET /api/admin/partner-sync/companies?status=pending&country=ae
async function listPendingCompanies(req, res) {
  try {
    const status = req.query.status || "pending";
    const country = req.query.country;
    let sql = "SELECT c.id, c.partner_id, a.partner_key, c.supplier_ref, c.payload_json, c.review_status, c.synced_at FROM partner_sync_companies c JOIN partner_accounts a ON a.id=c.partner_id WHERE c.review_status=?";
    const args = [status];
    if (country) { sql += " AND JSON_CONTAINS(a.countries_json, JSON_QUOTE(?))"; args.push(country); }
    sql += " ORDER BY c.synced_at DESC LIMIT 200";
    const [rows] = await pool.execute(sql, args);
    res.json({ items: rows });
  } catch (e) { console.error("[partner-admin] list companies error", e); res.status(500).json({ error: "internal error" }); }
}

// POST /api/admin/partner-sync/products/:id/approve
async function approveProduct(req, res) {
  try {
    const [rows] = await pool.execute("SELECT * FROM partner_sync_products WHERE id=?", [req.params.id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: "not found" });
    const partner = await loadPartner(row.partner_id);
    if (!partner) return res.status(400).json({ error: "partner missing" });
    await publish.publishProduct(partner, row, images.resolveFirstImage);
    await pool.execute("UPDATE partner_sync_products SET review_status='approved', reviewed_at=NOW() WHERE id=?", [row.id]);
    res.json({ ok: true, review_status: "approved" });
  } catch (e) { console.error("[partner-admin] approve error", e); res.status(500).json({ error: "internal error" }); }
}

// POST /api/admin/partner-sync/products/:id/reject
async function rejectProduct(req, res) {
  try {
    const [rows] = await pool.execute("SELECT * FROM partner_sync_products WHERE id=?", [req.params.id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: "not found" });
    const partner = await loadPartner(row.partner_id);
    if (partner) await publish.unpublishProduct(partner, row.external_id);
    await pool.execute("UPDATE partner_sync_products SET review_status='rejected', reviewed_at=NOW() WHERE id=?", [row.id]);
    res.json({ ok: true, review_status: "rejected" });
  } catch (e) { console.error("[partner-admin] reject error", e); res.status(500).json({ error: "internal error" }); }
}

// POST /api/admin/partner-sync/companies/:id/approve
async function approveCompany(req, res) {
  try {
    const [rows] = await pool.execute("SELECT * FROM partner_sync_companies WHERE id=?", [req.params.id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: "not found" });
    const partner = await loadPartner(row.partner_id);
    if (!partner) return res.status(400).json({ error: "partner missing" });
    const company = typeof row.payload_json === "string" ? JSON.parse(row.payload_json) : row.payload_json;
    // 传入 staging 行的 supplier_ref，确保企业发布到正确的供应商槽
    await publish.publishCompany(partner, company, row.supplier_ref || "");
    await pool.execute("UPDATE partner_sync_companies SET review_status='approved', reviewed_at=NOW() WHERE id=?", [row.id]);
    res.json({ ok: true, review_status: "approved" });
  } catch (e) { console.error("[partner-admin] approve company error", e); res.status(500).json({ error: "internal error" }); }
}

// POST /api/admin/partner-sync/companies/:id/reject
async function rejectCompany(req, res) {
  try {
    const [rows] = await pool.execute("SELECT * FROM partner_sync_companies WHERE id=?", [req.params.id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: "not found" });
    await pool.execute("UPDATE partner_sync_companies SET review_status='rejected', reviewed_at=NOW() WHERE id=?", [row.id]);
    res.json({ ok: true, review_status: "rejected" });
  } catch (e) { console.error("[partner-admin] reject company error", e); res.status(500).json({ error: "internal error" }); }
}

module.exports = { listPendingProducts, listPendingCompanies, approveProduct, rejectProduct, approveCompany, rejectCompany };
