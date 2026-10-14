"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseReferenceQuery = parseReferenceQuery;
exports.resolveCountry = resolveCountry;
exports.adminReferenceSearch = adminReferenceSearch;
const database_1 = __importDefault(require("../config/database"));
const VALID_COUNTRIES = new Set(['ae', 'vn', 'sa']);
function positiveSafeInteger(value) {
    if (!/^[1-9]\d*$/.test(value))
        return null;
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}
function parseReferenceQuery(input) {
    if (typeof input !== 'string')
        return null;
    const query = input.trim();
    const bare = positiveSafeInteger(query);
    if (bare)
        return { type: 'both', id: bare };
    const match = /^(supplier|product)\s*#?\s*([1-9]\d*)$/i.exec(query);
    if (!match)
        return null;
    const id = positiveSafeInteger(match[2]);
    return id ? { type: match[1].toLowerCase(), id } : null;
}
function resolveCountry(req) {
    const requested = typeof req.query.country === 'string' ? req.query.country.toLowerCase() : null;
    const admin = req.admin;
    if (!admin)
        return { error: 'Admin not authenticated.' };
    if (admin.role === 'super_admin') {
        // Super-admin selection follows the existing AE/VN admin country switcher.
        // SA staff remain scoped by their authenticated account below.
        if (requested !== 'ae' && requested !== 'vn')
            return { error: 'A valid admin view country (ae or vn) is required.' };
        return { country: requested };
    }
    if (!VALID_COUNTRIES.has(admin.country))
        return { error: 'Admin country is invalid.' };
    if (requested && requested !== admin.country)
        return { error: 'Country does not match administrator scope.' };
    return { country: admin.country };
}
async function adminReferenceSearch(req, res) {
    const reference = parseReferenceQuery(req.query.q);
    if (!reference)
        return res.json({ suppliers: [], products: [] });
    const scope = resolveCountry(req);
    if (scope.error)
        return res.status(403).json({ error: scope.error });
    try {
        const supplierQuery = `SELECT sp.id, sp.company_name AS name
       FROM supplier_profiles sp
       WHERE sp.id = ? AND sp.country = ?
       LIMIT 1`;
        const productQuery = `SELECT p.id, p.title, p.supplier_profile_id AS supplierId, sp.company_name AS supplierName
       FROM supplier_products p
       JOIN supplier_profiles sp ON sp.id = p.supplier_profile_id
       WHERE p.id = ? AND sp.country = ?
       LIMIT 1`;
        const lookups = [];
        if (reference.type === 'both' || reference.type === 'supplier')
            lookups.push(database_1.default.execute(supplierQuery, [reference.id, scope.country]));
        if (reference.type === 'both' || reference.type === 'product')
            lookups.push(database_1.default.execute(productQuery, [reference.id, scope.country]));
        const results = await Promise.all(lookups);
        let cursor = 0;
        const suppliers = reference.type === 'both' || reference.type === 'supplier' ? results[cursor++][0] : [];
        const products = reference.type === 'both' || reference.type === 'product' ? results[cursor++][0] : [];
        return res.json({ suppliers, products });
    }
    catch (error) {
        console.error('[AdminReferenceSearch]', error);
        return res.status(500).json({ error: 'Reference search failed.' });
    }
}
