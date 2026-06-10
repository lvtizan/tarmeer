"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTemplate = generateTemplate;
exports.parseTemplate = parseTemplate;
exports.importCompany = importCompany;
const docx_1 = require("docx");
const mammoth_1 = __importDefault(require("mammoth"));
const database_1 = __importDefault(require("../config/database"));
const slugify_1 = require("../lib/slugify");
// ============================================================
// Template field definitions
// ============================================================
const TEMPLATE_FIELDS = [
    { key: 'company_name', label: 'Company Name (EN)', labelAr: 'اسم الشركة', required: true, example: 'Algedra Interior Design' },
    { key: 'company_name_ar', label: 'Company Name (AR)', labelAr: 'اسم الشركة بالعربي', required: false, example: 'الكيدرا للتصميم الداخلي' },
    { key: 'company_type', label: 'Company Type', labelAr: 'نوع الشركة', required: true, example: 'Design Studio / Renovation Company' },
    { key: 'contact_person', label: 'Contact Person', labelAr: 'اسم جهة الاتصال', required: true, example: 'Ahmed Ali' },
    { key: 'phone', label: 'Phone', labelAr: 'رقم الهاتف', required: true, example: '+971 50 123 4567' },
    { key: 'email', label: 'Email', labelAr: 'البريد الإلكتروني', required: false, example: 'info@company.com' },
    { key: 'website', label: 'Website', labelAr: 'الموقع الإلكتروني', required: false, example: 'https://www.company.com' },
    { key: 'whatsapp', label: 'WhatsApp', labelAr: 'واتساب', required: false, example: '+971501234567' },
    { key: 'city', label: 'City', labelAr: 'المدينة', required: true, example: 'Dubai / Abu Dhabi / Sharjah / Ajman / RAK / Fujairah / UAQ' },
    { key: 'address', label: 'Full Address', labelAr: 'العنوان الكامل', required: false, example: 'Office 101, Al Quoz Industrial 1, Dubai' },
    { key: 'description', label: 'Company Description', labelAr: 'نبذة عن الشركة', required: true, example: 'Brief description of your company, services, and experience...' },
    { key: 'year_established', label: 'Year Established', labelAr: 'سنة التأسيس', required: false, example: '2010' },
    { key: 'license_number', label: 'Trade License Number', labelAr: 'رقم الرخصة التجارية', required: false, example: 'DED-12345' },
    { key: 'services', label: 'Services (comma separated)', labelAr: 'الخدمات', required: true, example: 'Interior Design, Fit-Out, Furniture, Renovation, Construction' },
    { key: 'specialties', label: 'Specialties (comma separated)', labelAr: 'التخصصات', required: false, example: 'Villa, Residential, Commercial, Hospitality' },
    { key: 'instagram', label: 'Instagram URL', labelAr: 'انستغرام', required: false, example: 'https://instagram.com/company' },
    { key: 'facebook', label: 'Facebook URL', labelAr: 'فيسبوك', required: false, example: '' },
    { key: 'linkedin', label: 'LinkedIn URL', labelAr: 'لينكدإن', required: false, example: '' },
];
// ============================================================
// Generate Word Template
// ============================================================
async function generateTemplate() {
    const noBorder = { style: docx_1.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const thinBorder = { style: docx_1.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
    const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
    const rows = TEMPLATE_FIELDS.map(field => {
        return new docx_1.TableRow({
            children: [
                // Field label
                new docx_1.TableCell({
                    width: { size: 35, type: docx_1.WidthType.PERCENTAGE },
                    borders,
                    children: [new docx_1.Paragraph({
                            children: [
                                new docx_1.TextRun({ text: field.label, bold: true, size: 20, font: 'Arial' }),
                                ...(field.required ? [new docx_1.TextRun({ text: ' *', color: 'FF0000', bold: true, size: 20, font: 'Arial' })] : []),
                                new docx_1.TextRun({ text: `\n${field.labelAr}`, size: 18, color: '888888', font: 'Arial' }),
                            ],
                        })],
                }),
                // Value (empty for user to fill, with example as placeholder)
                new docx_1.TableCell({
                    width: { size: 65, type: docx_1.WidthType.PERCENTAGE },
                    borders,
                    children: [new docx_1.Paragraph({
                            children: [
                                new docx_1.TextRun({ text: '', size: 20, font: 'Arial' }),
                            ],
                        }),
                        ...(field.example ? [new docx_1.Paragraph({
                                children: [new docx_1.TextRun({ text: `Example: ${field.example}`, size: 16, color: 'AAAAAA', italics: true, font: 'Arial' })],
                            })] : []),
                    ],
                }),
            ],
        });
    });
    const doc = new docx_1.Document({
        sections: [{
                children: [
                    // Header
                    new docx_1.Paragraph({
                        alignment: docx_1.AlignmentType.CENTER,
                        spacing: { after: 200 },
                        children: [
                            new docx_1.TextRun({ text: 'TARMEER', bold: true, size: 36, color: 'B8864A', font: 'Arial' }),
                        ],
                    }),
                    new docx_1.Paragraph({
                        alignment: docx_1.AlignmentType.CENTER,
                        spacing: { after: 100 },
                        children: [
                            new docx_1.TextRun({ text: 'Company Information Form', bold: true, size: 28, font: 'Arial' }),
                        ],
                    }),
                    new docx_1.Paragraph({
                        alignment: docx_1.AlignmentType.CENTER,
                        spacing: { after: 400 },
                        children: [
                            new docx_1.TextRun({ text: 'Please fill in your company details below. Fields marked with * are required.', size: 20, color: '666666', font: 'Arial' }),
                        ],
                    }),
                    // Table
                    new docx_1.Table({
                        width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
                        rows,
                    }),
                    // Footer note
                    new docx_1.Paragraph({ spacing: { before: 400 }, children: [] }),
                    new docx_1.Paragraph({
                        children: [
                            new docx_1.TextRun({ text: 'Available Services: ', bold: true, size: 18, font: 'Arial' }),
                            new docx_1.TextRun({ text: 'Interior Design, Architecture, Fit-Out, Renovation, Construction, Landscape, Furniture, Joinery, MEP, Project Management, Design & Build, Turnkey Solutions, Maintenance', size: 18, color: '666666', font: 'Arial' }),
                        ],
                    }),
                    new docx_1.Paragraph({
                        spacing: { before: 100 },
                        children: [
                            new docx_1.TextRun({ text: 'Available Specialties: ', bold: true, size: 18, font: 'Arial' }),
                            new docx_1.TextRun({ text: 'Residential, Villa, Commercial, Hospitality, Retail, Office, Education, Healthcare, F&B, Luxury Residential, Mixed-Use', size: 18, color: '666666', font: 'Arial' }),
                        ],
                    }),
                    new docx_1.Paragraph({
                        spacing: { before: 100 },
                        children: [
                            new docx_1.TextRun({ text: 'Available Cities: ', bold: true, size: 18, font: 'Arial' }),
                            new docx_1.TextRun({ text: 'Dubai, Abu Dhabi, Sharjah, Ajman, Ras Al Khaimah, Fujairah, Umm Al Quwain', size: 18, color: '666666', font: 'Arial' }),
                        ],
                    }),
                ],
            }],
    });
    return Buffer.from(await docx_1.Packer.toBuffer(doc));
}
// ============================================================
// Parse filled Word template
// ============================================================
async function parseTemplate(buffer) {
    // Extract text content from docx
    const result = await mammoth_1.default.extractRawText({ buffer });
    const text = result.value;
    const parsed = {};
    // Parse by matching field labels
    for (let i = 0; i < TEMPLATE_FIELDS.length; i++) {
        const field = TEMPLATE_FIELDS[i];
        const label = field.label;
        const nextLabel = i + 1 < TEMPLATE_FIELDS.length ? TEMPLATE_FIELDS[i + 1].label : null;
        // Find the label in the text
        const labelIdx = text.indexOf(label);
        if (labelIdx === -1)
            continue;
        // Get text after this label until next label
        const afterLabel = text.substring(labelIdx + label.length);
        let value;
        if (nextLabel) {
            const nextIdx = afterLabel.indexOf(nextLabel);
            value = nextIdx > -1 ? afterLabel.substring(0, nextIdx) : afterLabel.substring(0, 500);
        }
        else {
            // Last field — take until "Available Services" or end
            const endIdx = afterLabel.indexOf('Available Services');
            value = endIdx > -1 ? afterLabel.substring(0, endIdx) : afterLabel.substring(0, 500);
        }
        // Clean up: remove Arabic label, "Example:" hints, asterisks, whitespace
        value = value
            .replace(field.labelAr, '')
            .replace(/Example:.*$/gm, '')
            .replace(/^\s*\*?\s*/, '')
            .replace(/\n+/g, ' ')
            .trim();
        if (value) {
            parsed[field.key] = value;
        }
    }
    return parsed;
}
// ============================================================
// Import parsed data into database
// ============================================================
// slugify is now imported from '../lib/slugify'
async function importCompany(data, adminId) {
    const name = data.company_name;
    if (!name)
        throw new Error('Company name is required');
    const slug = (0, slugify_1.slugify)(name);
    const services = data.services
        ? JSON.stringify(data.services.split(',').map((s) => s.trim()).filter(Boolean))
        : '["Interior Design"]';
    const specialties = data.specialties
        ? JSON.stringify(data.specialties.split(',').map((s) => s.trim()).filter(Boolean))
        : null;
    const rawType = (data.company_type || '').toLowerCase();
    const companyType = rawType.includes('design') ? 'design_studio'
        : rawType.includes('mep') || rawType.includes('hvac') ? 'mep_contractor'
            : rawType.includes('general') || rawType.includes('construction') ? 'general_contractor'
                : rawType.includes('maintenance') ? 'maintenance_company'
                    : rawType.includes('landscape') || rawType.includes('pool') ? 'landscaping'
                        : rawType.includes('specialty') || rawType.includes('glass') || rawType.includes('steel') ? 'specialty_trade'
                            : 'renovation_company';
    // Insert into company_profiles (as admin-created, auto-approved)
    const [result] = await database_1.default.execute(`INSERT INTO company_profiles (
      user_id, company_name, company_type, description, contact_person,
      phone, website, city, address, services, specialties,
      trade_license_number, establishment_year, slug, status, reviewed_by, reviewed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, NOW())`, [
        0, // placeholder user_id — will be linked when company claims
        name,
        companyType,
        data.description || '',
        data.contact_person || '',
        data.phone || '',
        data.website || null,
        data.city || 'Dubai',
        data.address || '',
        services,
        specialties,
        data.license_number || null,
        data.year_established ? parseInt(data.year_established) : null,
        slug,
        adminId,
    ]);
    const insertId = result.insertId;
    // Also insert into uae_companies for public directory
    await database_1.default.execute(`INSERT INTO uae_companies (
      name_en, name_ar, slug, phone, email, website, whatsapp,
      city, address, services, specialties, year_established,
      license_number, instagram, facebook, linkedin, description,
      is_active, is_verified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`, [
        name,
        data.company_name_ar || null,
        slug,
        data.phone || null,
        data.email || null,
        data.website || null,
        data.whatsapp || null,
        data.city || 'Dubai',
        data.address || null,
        services,
        specialties,
        data.year_established || null,
        data.license_number || null,
        data.instagram || null,
        data.facebook || null,
        data.linkedin || null,
        data.description || null,
    ]);
    return { id: insertId, name };
}
