"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeCompanyImage = sanitizeCompanyImage;
exports.extractPortfolioData = extractPortfolioData;
exports.sanitizePublicCompany = sanitizePublicCompany;
const parseJsonField_1 = require("./parseJsonField");
const publicImageCleanup_1 = require("./publicImageCleanup");
function toPublicString(value) {
    return typeof value === 'string' ? value : '';
}
function sanitizeCompanyImage(value) {
    const url = toPublicString(value).trim();
    if (!url)
        return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:'))
        return url;
    if (url.startsWith('//'))
        return `https:${url}`;
    if (url.startsWith('/')) {
        // Hotfix known historical wrong extensions in scraped dataset
        if (url === '/images/uae-companies/portfolio/hba-hirsch-bedner/general/1.png') {
            return '/images/uae-companies/portfolio/hba-hirsch-bedner/general/1.jpg';
        }
        if (url === '/images/uae-companies/portfolio/appello-interiors/interior/1.png') {
            return '/images/uae-companies/portfolio/appello-interiors/interior/1.jpg';
        }
        if (url === '/images/uae-companies/portfolio/appello-interiors/cafe/1.png') {
            return '/images/uae-companies/portfolio/appello-interiors/cafe/1.jpg';
        }
        if (url === '/images/uae-companies/portfolio/eminent-interio/office/1.png') {
            return '/images/uae-companies/portfolio/eminent-interio/office/1.jpg';
        }
        return url;
    }
    if (url.startsWith('./'))
        return `/${url.replace(/^\.\/+/, '')}`;
    if (url.startsWith('www.'))
        return `https://${url}`;
    if (url.startsWith('public/images/'))
        return `/${url.replace(/^public\//, '')}`;
    if (url.startsWith('public/uploads/'))
        return `/${url.replace(/^public\//, '')}`;
    if (url.startsWith('images/') || url.startsWith('uploads/'))
        return `/${url}`;
    return '';
}
function extractPortfolioData(rawField) {
    const parsed = (0, parseJsonField_1.parseJsonField)(rawField);
    // Object form: keys are category names, values are either:
    //  (a) legacy array of { url, title }          — from old scraper runs
    //  (b) new object { items, description, year, location, sourceUrl }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const categories = {};
        const metadata = {};
        const flatUrls = [];
        for (const [category, entry] of Object.entries(parsed)) {
            // Resolve the items list + optional metadata from either shape.
            let rawItems = null;
            let meta = null;
            if (Array.isArray(entry)) {
                // Legacy array shape
                rawItems = entry;
            }
            else if (entry && typeof entry === 'object') {
                // New object shape with `items` field
                const obj = entry;
                if (Array.isArray(obj.items)) {
                    rawItems = obj.items;
                    meta = {
                        description: typeof obj.description === 'string' ? obj.description : '',
                        year: typeof obj.year === 'number' ? obj.year : null,
                        location: typeof obj.location === 'string' ? obj.location : '',
                        sourceUrl: typeof obj.sourceUrl === 'string' ? obj.sourceUrl : '',
                    };
                }
            }
            if (!Array.isArray(rawItems))
                continue;
            const sanitizedItems = [];
            for (const item of rawItems) {
                if (item && typeof item === 'object' && 'url' in item) {
                    const url = sanitizeCompanyImage(item.url);
                    if (url) {
                        const title = typeof item.title === 'string' ? item.title : '';
                        sanitizedItems.push({ url, title });
                        flatUrls.push(url);
                    }
                }
            }
            categories[category] = sanitizedItems;
            if (meta && (meta.description || meta.year || meta.location || meta.sourceUrl)) {
                metadata[category] = meta;
            }
        }
        return { portfolio_images: flatUrls, portfolio_categories: categories, portfolio_metadata: metadata };
    }
    // Legacy flat array format
    const flatUrls = (0, publicImageCleanup_1.sanitizeImageUrls)(Array.isArray(parsed) ? parsed : []);
    const categories = {
        Projects: flatUrls.map((url) => ({ url, title: '' })),
    };
    return { portfolio_images: flatUrls, portfolio_categories: categories, portfolio_metadata: {} };
}
function sanitizePublicCompany(company) {
    const { portfolio_images, portfolio_categories, portfolio_metadata } = extractPortfolioData(company.portfolio_images);
    // Claimed companies (registered or claimed directory) hide contact info — they acquire
    // leads through the platform, showing contact lets homeowners bypass it.
    const isClaimed = !!(company.owner_user_id);
    return {
        id: company.id,
        slug: toPublicString(company.slug),
        name_en: toPublicString(company.name_en),
        description: toPublicString(company.description),
        city: toPublicString(company.city),
        address: toPublicString(company.address),
        year_established: toPublicString(company.year_established),
        website: isClaimed ? '' : toPublicString(company.website),
        instagram: toPublicString(company.instagram),
        phone: '', // WA/phone always hidden — leads go through platform inquiry form
        email: isClaimed ? '' : toPublicString(company.email),
        services: (0, parseJsonField_1.parseJsonField)(company.services) || [],
        specialties: (0, parseJsonField_1.parseJsonField)(company.specialties) || [],
        logo_url: sanitizeCompanyImage(company.logo_url),
        portfolio_images,
        portfolio_categories,
        portfolio_metadata,
        project_count: portfolio_images.length,
        is_claimed: isClaimed,
        is_signed: !!(company.is_signed),
        company_profile_id: company.company_profile_id ?? null,
    };
}
