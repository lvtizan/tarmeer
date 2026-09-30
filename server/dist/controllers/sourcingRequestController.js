"use strict";
// 中国新材料采购线索（spec: docs/plans/china-materials-revamp-spec.md §3.2 / §3.3）
// 四类：sample 样品申请 / visit 到店预约 / sourcing 采购咨询 / designer_partner 设计师合作
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitSourcingRequest = submitSourcingRequest;
exports.adminListSourcingRequests = adminListSourcingRequests;
exports.adminUpdateSourcingRequestStatus = adminUpdateSourcingRequestStatus;
const database_1 = __importDefault(require("../config/database"));
const detectCountry_1 = require("../lib/detectCountry");
const {createHash} = require('crypto');
const {metadata} = require('../lib/materialProcurement');
const {maskSupplierValue} = require('../lib/supplierRedact');
const REQUEST_TYPES = ['sample', 'visit', 'sourcing', 'designer_partner', 'quote'];
function adminCountry(req) {
    const country = req.admin?.role === 'super_admin' ? (req.query.country || req.admin.country) : req.admin?.country;
    return ['ae','vn','sa'].includes(country) ? country : null;
}
const STATUSES = ['new', 'contacted', 'completed', 'rejected'];
// 长度截断防超长（上限对齐 sourcing_requests 各列定义）
function clip(value, max) {
    if (value === undefined || value === null)
        return null;
    const s = String(value).trim();
    return s ? s.slice(0, max) : null;
}
// POST /api/sourcing-requests（公开，限流在路由层）
async function submitSourcingRequest(req, res) {
    try {
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({error:'Request body must be an object.'});
        for (const field of ['name','phone','email','company_name','city','message','preferred_date','quantity_unit','source_page']) {
            if (req.body[field] !== undefined && req.body[field] !== null && typeof req.body[field] !== 'string') return res.status(400).json({error:`${field} must be text.`});
        }
        if (req.body.quantity_unknown !== undefined && typeof req.body.quantity_unknown !== 'boolean') return res.status(400).json({error:'quantity_unknown must be a boolean.'});
        const { request_type } = req.body;
        if (!REQUEST_TYPES.includes(request_type)) {
            return res.status(400).json({ error: 'Invalid request_type.' });
        }
        const name = clip(req.body.name, 120);
        const phone = clip(req.body.phone, 40);
        if (!name || !phone) {
            return res.status(400).json({ error: 'Name and phone are required.' });
        }
        let productId = null;
        if (req.body.product_id !== undefined && req.body.product_id !== null && req.body.product_id !== '') {
            if (!['number','string'].includes(typeof req.body.product_id)) return res.status(400).json({error:'Invalid product_id.'});
            const n = Number(req.body.product_id);
            if (!Number.isSafeInteger(n) || n <= 0)
                return res.status(400).json({ error: 'Invalid product_id.' });
            productId = n;
        }
        if (['sample','quote'].includes(request_type) && !productId) {
            return res.status(400).json({ error: 'product_id is required for sample and quote requests.' });
        }
        // 引用产品必须是「已审核+已发布」供应商的产品；同时取供应商国家用于线索归属
        let refCountry = null;
        let productSnapshot = null;
        if (productId) {
            const [prodRows] = await database_1.default.execute(`SELECT p.id, p.title, p.title_translated, p.specs, p.supplier_profile_id, sp.country, sp.company_name, sp.name_zh FROM supplier_products p
           JOIN supplier_profiles sp ON sp.id = p.supplier_profile_id
           WHERE p.id = ? AND sp.status = 'approved' AND sp.is_published = 1`, [productId]);
            if (prodRows.length === 0)
                return res.status(400).json({ error: 'Product not found.' });
            refCountry = prodRows[0].country || null;
            productSnapshot = prodRows[0];
        }
        let supplierProfileId = null;
        if (req.body.supplier_profile_id !== undefined && req.body.supplier_profile_id !== null && req.body.supplier_profile_id !== '') {
            if (!['number','string'].includes(typeof req.body.supplier_profile_id)) return res.status(400).json({error:'Invalid supplier_profile_id.'});
            const n = Number(req.body.supplier_profile_id);
            if (!Number.isSafeInteger(n) || n <= 0)
                return res.status(400).json({ error: 'Invalid supplier_profile_id.' });
            const [supRows] = await database_1.default.execute(`SELECT id, country FROM supplier_profiles WHERE id = ? AND status = 'approved' AND is_published = 1`, [n]);
            if (supRows.length === 0)
                return res.status(400).json({ error: 'Supplier not found.' });
            supplierProfileId = n;
            if (!refCountry)
                refCountry = supRows[0].country || null;
        }
        if (productSnapshot && supplierProfileId && Number(productSnapshot.supplier_profile_id) !== supplierProfileId) return res.status(400).json({error:'Product does not belong to this supplier.'});
        if (productSnapshot) supplierProfileId = Number(productSnapshot.supplier_profile_id);
        const unknown = req.body.quantity_unknown === true;
        const quantity = req.body.quantity === undefined || req.body.quantity === '' || req.body.quantity === null ? null : Number(req.body.quantity);
        const quantityUnit = clip(req.body.quantity_unit,40);
        if (['quote','sample'].includes(request_type) && !unknown && (quantity === null || !quantityUnit)) return res.status(400).json({error:'Provide a quantity and unit, or mark quantity as unknown.'});
        if (!unknown && quantity !== null && (!['number','string'].includes(typeof req.body.quantity) || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1e12 || !quantityUnit)) return res.status(400).json({error:'Quantity must be positive and include a unit.'});
        const area = req.body.project_area === undefined || req.body.project_area === null || req.body.project_area === '' ? null : Number(req.body.project_area);
        if (area !== null && (!['number','string'].includes(typeof req.body.project_area) || !Number.isFinite(area) || area <= 0 || area > 1e9)) return res.status(400).json({error:'Project area must be positive.'});
        const clientKey = req.body.request_key;
        if (clientKey !== undefined && (typeof clientKey !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(clientKey))) return res.status(400).json({error:'Invalid request_key.'});
        // 国家归属（对齐 design_inquiries 口径：带引用按引用实体国家，无引用按 phone 前缀，最后 req.country 兜底）
        // 这样带产品/供应商引用的线索永远与引用实体同国家，admin 展示 JOIN 不会跨国串文字。
        const normalizedPhone = phone.replace(/\s+/g, '');
        const country = refCountry
            || ((0, detectCountry_1.detectCountry)(normalizedPhone) === 'vn' ? 'vn' : (req.country || 'ae'));
        const context = { recipient:'Tarmeer', project_area:area, product_title: productSnapshot ? maskSupplierValue(productSnapshot.title_translated || productSnapshot.title,productSnapshot.company_name,productSnapshot.name_zh) : null, product_model: productSnapshot ? maskSupplierValue(metadata(productSnapshot).model,productSnapshot.company_name,productSnapshot.name_zh) : null, quantity:unknown?null:quantity, quantity_unit:unknown?null:quantityUnit, quantity_unknown:unknown };
        const requestKey = clientKey ? createHash('sha256').update([country,normalizedPhone,clientKey].join('\0')).digest('hex') : null;
        const fingerprint = createHash('sha256').update(JSON.stringify([request_type,name,normalizedPhone,productId,supplierProfileId,{quantity:context.quantity,quantity_unit:context.quantity_unit,quantity_unknown:context.quantity_unknown,project_area:area},clip(req.body.email,160),clip(req.body.company_name,160),clip(req.body.city,80),clip(req.body.message,5000),clip(req.body.preferred_date,40)])).digest('hex');
        context.fingerprint = fingerprint;
        let result;
        try { [result] = await database_1.default.execute(`INSERT INTO sourcing_requests
        (request_type, name, phone, email, company_name, city, message, preferred_date, product_id, supplier_profile_id, source_page, country, request_context, request_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            request_type, name, phone,
            clip(req.body.email, 160), clip(req.body.company_name, 160), clip(req.body.city, 80),
            clip(req.body.message, 5000), clip(req.body.preferred_date, 40),
            productId, supplierProfileId, clip(req.body.source_page, 500), country, JSON.stringify(context), requestKey,
        ]);
        } catch(error) {
            if (error.code !== 'ER_DUP_ENTRY' || !requestKey) throw error;
            const [existing] = await database_1.default.execute('SELECT id, request_context FROM sourcing_requests WHERE request_key = ? AND country = ?', [requestKey,country]);
            const prior = existing[0];
            const priorContext = typeof prior?.request_context === 'string' ? JSON.parse(prior.request_context) : prior?.request_context;
            if (!prior || priorContext?.fingerprint !== fingerprint) return res.status(409).json({error:'This request key was already used. Start a new request.'});
            return res.status(200).json({id:prior.id,duplicate:true});
        }
        res.status(201).json({ id: result.insertId });
    }
    catch (error) {
        console.error('Submit sourcing request error:', error);
        res.status(500).json({ error: 'Submission failed.' });
    }
}
// GET /api/admin/sourcing-requests?country&type&status&page&limit（admin）
async function adminListSourcingRequests(req, res) {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const offset = (page - 1) * limit;
        // 国家隔离铁律：admin 列表必须按国家过滤（对齐 admin/suppliers：query 优先 → x-country → 'ae'）
        const country = adminCountry(req);
        if (!country) return res.status(403).json({error:'Country access denied.'});
        let where = 'WHERE sr.country = ?';
        const params = [country];
        const type = req.query.type;
        if (type && REQUEST_TYPES.includes(type)) {
            where += ' AND sr.request_type = ?';
            params.push(type);
        }
        // 各状态计数按 country+type 过滤（不含 status 过滤，供状态 tab 显示）
        const [countByStatus] = await database_1.default.execute(`SELECT sr.status, COUNT(*) as cnt FROM sourcing_requests sr ${where} GROUP BY sr.status`, params);
        const counts = { new: 0, contacted: 0, completed: 0, rejected: 0, total: 0 };
        for (const row of countByStatus) {
            counts[row.status] = Number(row.cnt);
            counts.total += Number(row.cnt);
        }
        const status = req.query.status;
        if (status && STATUSES.includes(status)) {
            where += ' AND sr.status = ?';
            params.push(status);
        }
        const [totalRows] = await database_1.default.execute(`SELECT COUNT(*) as total FROM sourcing_requests sr ${where}`, params);
        const total = totalRows[0].total;
        // LIMIT/OFFSET 拼过整数校验的数字（pool.execute 传参会报错——已知坑）
        // 国家隔离铁律第2条：解析引用的 JOIN 带国家一致性条件——即使数据错了，错国家的文字也不漏进列表
        const [rows] = await database_1.default.query(`SELECT sr.*, p.title AS product_title, sp.company_name AS supplier_name
       FROM sourcing_requests sr
       LEFT JOIN supplier_products p
         ON p.id = sr.product_id
        AND EXISTS (SELECT 1 FROM supplier_profiles psp WHERE psp.id = p.supplier_profile_id AND psp.country COLLATE utf8mb4_unicode_ci = sr.country)
       LEFT JOIN supplier_profiles sp ON sp.id = sr.supplier_profile_id AND sp.country COLLATE utf8mb4_unicode_ci = sr.country
       ${where}
       ORDER BY sr.created_at DESC, sr.id DESC
       LIMIT ${limit} OFFSET ${offset}`, params);
        res.json({
            requests: rows.map(row => { const context = typeof row.request_context === 'string' ? JSON.parse(row.request_context) : row.request_context; if(context) delete context.fingerprint; const {request_key,...rest}=row; return {...rest,request_context:context || null}; }),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            counts,
        });
    }
    catch (error) {
        console.error('List sourcing requests error:', error);
        res.status(500).json({ error: 'Failed to load sourcing requests.' });
    }
}
// PUT /api/admin/sourcing-requests/:id/status body {status}（admin）
async function adminUpdateSourcingRequestStatus(req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0)
            return res.status(400).json({ error: 'Invalid id.' });
        const { status } = req.body;
        if (!STATUSES.includes(status))
            return res.status(400).json({ error: 'Invalid status.' });
        // 国家隔离铁律：更新按 country 作用域（对齐 list；前端 PUT 带 ?country=，超管切国家亦对），防跨国改单。
        const country = adminCountry(req);
        if (!country) return res.status(403).json({error:'Country access denied.'});
        const [result] = await database_1.default.execute('UPDATE sourcing_requests SET status = ? WHERE id = ? AND country = ?', [status, id, country]);
        if (result.affectedRows === 0)
            return res.status(404).json({ error: 'Request not found.' });
        res.json({ message: 'Status updated.' });
    }
    catch (error) {
        console.error('Update sourcing request status error:', error);
        res.status(500).json({ error: 'Failed to update status.' });
    }
}
