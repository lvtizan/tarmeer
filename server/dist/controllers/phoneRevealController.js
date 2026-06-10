"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.revealPhone = revealPhone;
exports.getPhoneRevealStats = getPhoneRevealStats;
const database_1 = __importDefault(require("../config/database"));

const VALID_COUNTRIES = new Set(['ae', 'vn', 'sa']);
// target_type 沿用项目既有命名：uae = 目录公司，profile = 注册装企，expert = 专家（二期接入）
const VALID_TARGETS = new Set(['uae', 'profile', 'expert']);

// ── 自动迁移（幂等）─────────────────────────────────────────────────────────
async function ensurePhoneRevealsTable() {
    try {
        await database_1.default.execute(`
      CREATE TABLE IF NOT EXISTS phone_reveals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        target_type VARCHAR(10) NOT NULL,
        target_id INT NOT NULL,
        country VARCHAR(5) NOT NULL DEFAULT 'ae' COLLATE utf8mb4_0900_ai_ci,
        viewer_ip VARCHAR(64) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_target (target_type, target_id),
        INDEX idx_created (created_at),
        INDEX idx_country (country)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci
    `);
    }
    catch (e) {
        console.error('[phone-reveals] ensureTable:', e.message);
    }
}
async function ensureCertifiedColumns() {
    for (const table of ['company_profiles', 'uae_companies']) {
        try {
            const [existing] = await database_1.default.execute(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'is_certified'`, [table]);
            if (existing.length === 0) {
                await database_1.default.execute(`ALTER TABLE ${table} ADD COLUMN is_certified TINYINT(1) NOT NULL DEFAULT 0`);
                console.log(`[phone-reveals] added column: ${table}.is_certified`);
            }
        }
        catch (e) {
            console.error(`[phone-reveals] ensureCertified ${table}:`, e.message);
        }
    }
}
ensurePhoneRevealsTable();
ensureCertifiedColumns();

function getClientIp(req) {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length > 0)
        return fwd.split(',')[0].trim().slice(0, 64);
    return (req.socket?.remoteAddress || '').slice(0, 64);
}

// 完整电话只从这里返回；详情接口一律给遮罩号（防爬虫绕过点击统计）
// POST /api/phone-reveals  { target_type, target_id }
async function revealPhone(req, res) {
    try {
        const targetType = String(req.body.target_type || '');
        const targetId = parseInt(req.body.target_id, 10);
        if (!VALID_TARGETS.has(targetType) || !Number.isInteger(targetId) || targetId <= 0) {
            return res.status(400).json({ error: 'Invalid target.' });
        }
        let phone = null;
        let country = 'ae';
        if (targetType === 'uae') {
            const [rows] = await database_1.default.execute('SELECT phone, country FROM uae_companies WHERE id = ? LIMIT 1', [targetId]);
            phone = rows[0]?.phone || null;
            country = rows[0]?.country || 'ae';
        }
        else if (targetType === 'expert') {
            const [rows] = await database_1.default.execute("SELECT phone, country FROM expert_profiles WHERE id = ? AND status = 'approved' LIMIT 1", [targetId]).catch(() => [[]]);
            phone = rows[0]?.phone || null;
            country = rows[0]?.country || 'ae';
        }
        else {
            // 注册装企电话按平台策略不对外展示（付费线索），不支持 reveal
            return res.status(403).json({ error: 'Phone not available for this target.' });
        }
        if (!phone) {
            return res.status(404).json({ error: 'No phone on record.' });
        }
        if (!VALID_COUNTRIES.has(country))
            country = 'ae';
        // 同 IP 同目标当天去重，防刷量
        const ip = getClientIp(req);
        const [dup] = await database_1.default.execute(`SELECT id FROM phone_reveals WHERE target_type = ? AND target_id = ? AND viewer_ip = ? AND created_at >= CURDATE() LIMIT 1`, [targetType, targetId, ip]);
        if (dup.length === 0) {
            await database_1.default.execute(`INSERT INTO phone_reveals (target_type, target_id, country, viewer_ip) VALUES (?, ?, ?, ?)`, [targetType, targetId, country, ip]);
        }
        res.json({ phone });
    }
    catch (e) {
        console.error('revealPhone error:', e);
        res.status(500).json({ error: 'Failed to reveal phone.' });
    }
}

// GET /api/admin/analytics/phone-reveals?country=&days=30
// 返回：总量、按日趋势、被点击排行（带名称）
async function getPhoneRevealStats(req, res) {
    try {
        const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));
        const country = VALID_COUNTRIES.has(req.query.country) ? req.query.country : null;
        const countryWhere = country ? ' AND country = ?' : '';
        const countryParams = country ? [country] : [];
        const [totalRows] = await database_1.default.execute(`SELECT COUNT(*) AS total FROM phone_reveals WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)${countryWhere}`, [days, ...countryParams]);
        const [trend] = await database_1.default.execute(`SELECT DATE(created_at) AS date, COUNT(*) AS count
       FROM phone_reveals
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)${countryWhere}
       GROUP BY DATE(created_at) ORDER BY date ASC`, [days, ...countryParams]);
        const [top] = await database_1.default.execute(`SELECT pr.target_type, pr.target_id, COUNT(*) AS count,
              CASE pr.target_type
                WHEN 'uae' THEN ANY_VALUE(uc.name_en)
                WHEN 'expert' THEN ANY_VALUE(ep.full_name)
                ELSE NULL
              END AS target_name
       FROM phone_reveals pr
       LEFT JOIN uae_companies uc ON pr.target_type = 'uae' AND uc.id = pr.target_id
       LEFT JOIN expert_profiles ep ON pr.target_type = 'expert' AND ep.id = pr.target_id
       WHERE pr.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)${countryWhere.replace('country', 'pr.country')}
       GROUP BY pr.target_type, pr.target_id
       ORDER BY count DESC
       LIMIT 20`, [days, ...countryParams]).catch(async () => {
            // expert_profiles 表二期才有：降级为只关联公司表
            return database_1.default.execute(`SELECT pr.target_type, pr.target_id, COUNT(*) AS count, ANY_VALUE(uc.name_en) AS target_name
         FROM phone_reveals pr
         LEFT JOIN uae_companies uc ON pr.target_type = 'uae' AND uc.id = pr.target_id
         WHERE pr.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)${countryWhere.replace('country', 'pr.country')}
         GROUP BY pr.target_type, pr.target_id
         ORDER BY count DESC
         LIMIT 20`, [days, ...countryParams]);
        });
        res.json({
            total: Number(totalRows[0]?.total || 0),
            days,
            trend,
            top,
        });
    }
    catch (e) {
        console.error('getPhoneRevealStats error:', e);
        res.status(500).json({ error: 'Failed to get phone reveal stats.' });
    }
}
