"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalSearch = globalSearch;
const database_1 = __importDefault(require("../config/database"));
function parseChannel(sourcePageUrl) {
    if (!sourcePageUrl)
        return '官网';
    try {
        const u = new URL(sourcePageUrl, 'https://www.tarmeer.com');
        const src = u.searchParams.get('utm_source')?.toLowerCase();
        if (!src)
            return '官网';
        const MAP = {
            tiktok: 'TikTok', tk: 'TikTok',
            instagram: 'Instagram', ig: 'Instagram',
            google: 'Google', facebook: 'Facebook', fb: 'Facebook',
            whatsapp: 'WhatsApp', wa: 'WhatsApp', linkedin: 'LinkedIn',
        };
        return MAP[src] || src;
    }
    catch {
        return '官网';
    }
}
async function globalSearch(req, res) {
    const q = (req.query.q || '').trim();
    if (q.length < 2)
        return res.json({ homeownerLeads: [], companyLeads: [], users: [], registeredCompanies: [], directoryCompanies: [], suppliers: [] });
    const like = `%${q}%`;
    try {
        const settled = await Promise.allSettled([
            // Homeowner leads
            database_1.default.execute(`SELECT di.id, di.name, di.phone, di.city, di.source_company_name, di.crm_sync_status, di.crm_action, di.created_at
         FROM design_inquiries di
         WHERE di.deleted_at IS NULL
           AND (di.message IS NULL OR di.message NOT LIKE '[Company Inquiry]%')
           AND (di.name LIKE ? OR di.phone LIKE ? OR di.source_company_name LIKE ?)
         ORDER BY di.created_at DESC LIMIT 5`, [like, like, like]),
            // Company leads — join company_leads for source_page channel
            database_1.default.execute(`SELECT di.id, di.name, di.phone, di.city, di.source_company_name, di.crm_sync_status, di.crm_action, di.created_at,
                cl.source_page, cl.company_name as cl_company_name, cl.company_type
         FROM design_inquiries di
         LEFT JOIN company_leads cl ON cl.phone COLLATE utf8mb4_unicode_ci = di.phone COLLATE utf8mb4_unicode_ci
         WHERE di.deleted_at IS NULL
           AND di.message LIKE '[Company Inquiry]%'
           AND (di.name LIKE ? OR di.phone LIKE ? OR di.source_company_name LIKE ?)
         GROUP BY di.id
         ORDER BY di.created_at DESC LIMIT 5`, [like, like, like]),
            // Users
            database_1.default.execute(`SELECT id, full_name, phone, email, role, active_role, signup_source, status, created_at
         FROM users
         WHERE deleted_at IS NULL
           AND (full_name LIKE ? OR phone LIKE ? OR email LIKE ?)
         ORDER BY created_at DESC LIMIT 5`, [like, like, like]),
            // Registered companies (column is company_name, not name)
            database_1.default.execute(`SELECT cp.id, cp.company_name AS name, cp.phone, cp.city, cp.status, u.email
         FROM company_profiles cp
         LEFT JOIN users u ON u.id = cp.user_id
         WHERE cp.deleted_at IS NULL
           AND (cp.company_name LIKE ? OR cp.phone LIKE ? OR u.email LIKE ?)
         ORDER BY cp.created_at DESC LIMIT 5`, [like, like, like]),
            // Directory companies (column is name_en, not name)
            database_1.default.execute(`SELECT id, name_en AS name, phone, city, 'directory' as source
         FROM uae_companies
         WHERE name_en LIKE ? OR phone LIKE ?
         ORDER BY name_en LIMIT 5`, [like, like]),
            // Suppliers
            database_1.default.execute(`SELECT sp.id, sp.company_name AS name, su.email, sp.origin, sp.status
         FROM supplier_profiles sp
         JOIN supplier_users su ON su.id = sp.supplier_user_id
         WHERE sp.company_name LIKE ? OR sp.name_zh LIKE ? OR su.email LIKE ?
         ORDER BY sp.created_at DESC LIMIT 5`, [like, like, like]),
        ]);
        const pick = (i) => settled[i].status === 'fulfilled' ? settled[i].value : [[], []];
        const [hlRows, clRows, userRows, cpRows, ucRows, spRows] = settled.map((_, i) => pick(i));
        const homeownerLeads = hlRows[0].map((r) => ({
            id: r.id,
            name: r.name,
            phone: r.phone,
            city: r.city,
            source: r.source_company_name || '官网',
            crmStatus: r.crm_action || r.crm_sync_status,
            type: 'homeowner',
            createdAt: r.created_at,
        }));
        const companyLeads = clRows[0].map((r) => ({
            id: r.id,
            name: r.name,
            phone: r.phone,
            city: r.city,
            companyName: r.cl_company_name || r.source_company_name,
            channel: parseChannel(r.source_page),
            companyType: r.company_type,
            crmStatus: r.crm_action || r.crm_sync_status,
            type: 'company',
            createdAt: r.created_at,
        }));
        const users = userRows[0].map((r) => ({
            id: r.id,
            name: r.full_name,
            phone: r.phone,
            email: r.email,
            role: r.active_role || r.role,
            status: r.status,
            source: r.signup_source || '官网',
            createdAt: r.created_at,
        }));
        const registeredCompanies = cpRows[0].map((r) => ({
            id: r.id,
            name: r.name,
            phone: r.phone,
            city: r.city,
            status: r.status,
            email: r.email,
            type: 'registered',
        }));
        const directoryCompanies = ucRows[0].map((r) => ({
            id: r.id,
            name: r.name,
            phone: r.phone,
            city: r.city,
            type: 'directory',
        }));
        // 供应商需 can_view_suppliers 权限：无权限的子管理员搜不到供应商（与 GET /suppliers 门控一致，防搜索绕过）
        const canSuppliers = req.admin?.role === 'super_admin' || req.admin?.permissions?.can_view_suppliers === true;
        const suppliers = canSuppliers
            ? spRows[0].map((r) => ({
                id: r.id,
                name: r.name,
                email: r.email,
                origin: r.origin,
                status: r.status,
            }))
            : [];
        res.json({ homeownerLeads, companyLeads, users, registeredCompanies, directoryCompanies, suppliers });
    }
    catch (err) {
        console.error('[GlobalSearch]', err);
        res.status(500).json({ error: 'Search failed' });
    }
}
