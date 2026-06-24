"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool = require("../config/database").default;
const publish = require("../lib/partnerPublishService");
const images = require("../lib/partnerImageService");

async function loadPartner(partnerId) {
  const [rows] = await pool.execute("SELECT * FROM partner_accounts WHERE id=?", [partnerId]);
  return rows[0] || null;
}

// GET /api/admin/partner-sync/products?status=pending
async function listPendingProducts(req, res) {
  try {
    const status = req.query.status || "pending";
    const [rows] = await pool.execute(
      "SELECT id, partner_id, external_id, review_status, listing_status, is_deleted, synced_at FROM partner_sync_products WHERE review_status=? ORDER BY synced_at DESC LIMIT 200",
      [status]);
    res.json({ items: rows });
  } catch (e) { console.error("[partner-admin] list error", e); res.status(500).json({ error: "internal error" }); }
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
    await publish.publishCompany(partner, company);
    await pool.execute("UPDATE partner_sync_companies SET review_status='approved', reviewed_at=NOW() WHERE id=?", [row.id]);
    res.json({ ok: true, review_status: "approved" });
  } catch (e) { console.error("[partner-admin] approve company error", e); res.status(500).json({ error: "internal error" }); }
}

module.exports = { listPendingProducts, approveProduct, rejectProduct, approveCompany };
