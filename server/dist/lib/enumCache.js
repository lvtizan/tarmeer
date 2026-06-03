"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidateEnumCache = invalidateEnumCache;
exports.getValidTypes = getValidTypes;
exports.getValidServices = getValidServices;
const database_1 = __importDefault(require("../config/database"));
// Hardcoded fallbacks — used if DB tables don't exist yet
const FALLBACK_TYPES = [
    'design_studio', 'renovation_company', 'general_contractor',
    'mep_contractor', 'maintenance_company', 'specialty_trade', 'landscaping', 'furnishing',
    'fitout_contractor', 'glass_aluminium', 'waterproofing', 'smart_home', 'fire_fighting',
    'carpentry_joinery', 'stone_marble', 'steel_fabrication', 'cleaning_services',
    'manpower_supply', 'swimming_pool',
];
const FALLBACK_SERVICES = [
    'Interior Design', 'Architecture', 'Fit-Out', 'Renovation', 'Construction', 'Landscape',
    'Furniture', 'Joinery', 'MEP', 'Project Management', 'Design & Build', 'Turnkey Solutions',
    'Maintenance', 'Glass & Aluminium', 'Painting & Finishing', 'Flooring & Tiling', 'Demolition',
    'Steel & Fabrication', 'Curtains & Blinds', 'Cleaning Services', 'Pools', 'HVAC & Ducting',
    'Fire Fighting', 'Smart Home & Automation', 'Waterproofing', 'Solar Systems',
    'Epoxy & PU Flooring', 'Scaffolding', 'Lighting Installation', 'Stone & Marble Fixing',
    'Gypsum & Partitions', 'Deep Cleaning',
];
let typesCache = null;
let servicesCache = null;
function invalidateEnumCache() {
    typesCache = null;
    servicesCache = null;
}
async function getValidTypes() {
    if (typesCache)
        return typesCache;
    try {
        const [rows] = await database_1.default.execute('SELECT slug FROM company_types ORDER BY sort_order, slug');
        const slugs = rows.map((r) => r.slug);
        if (slugs.length > 0) {
            typesCache = slugs;
            return typesCache;
        }
    }
    catch { /* table not yet created */ }
    return FALLBACK_TYPES;
}
async function getValidServices() {
    if (servicesCache)
        return servicesCache;
    try {
        const [rows] = await database_1.default.execute('SELECT name FROM company_services ORDER BY sort_order, name');
        const names = rows.map((r) => r.name);
        if (names.length > 0) {
            servicesCache = names;
            return servicesCache;
        }
    }
    catch { /* table not yet created */ }
    return FALLBACK_SERVICES;
}
