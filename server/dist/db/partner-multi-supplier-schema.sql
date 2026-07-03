-- 多供应商支持：企业/商品按 partner 的 supplier_id 分组
-- 每个 (partner_id, supplier_ref) 对应一家独立的企业/供应商

ALTER TABLE partner_sync_companies ADD COLUMN supplier_ref VARCHAR(128) NOT NULL DEFAULT '';
ALTER TABLE partner_sync_products  ADD COLUMN supplier_ref VARCHAR(128) NOT NULL DEFAULT '';

-- 企业唯一键从 (partner_id) 改为 (partner_id, supplier_ref)
ALTER TABLE partner_sync_companies DROP INDEX uq_partner;
ALTER TABLE partner_sync_companies ADD UNIQUE KEY uq_partner_supplier (partner_id, supplier_ref);

-- 已发布供应商按 (partner, supplier_ref, country) 定位
ALTER TABLE supplier_profiles ADD COLUMN partner_supplier_ref VARCHAR(128) NULL;

-- 回填已有数据的 supplier_ref（从 payload attributes.supplier_id）
UPDATE partner_sync_companies SET supplier_ref = COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.attributes.supplier_id')), '') WHERE supplier_ref = '';
UPDATE partner_sync_products  SET supplier_ref = COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.attributes.supplier_id')), '') WHERE supplier_ref = '';
