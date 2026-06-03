"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPublicProjectsListQuery = buildPublicProjectsListQuery;
function buildPublicProjectsListQuery(input) {
    let whereClause = `WHERE p.status = ? AND cp.status = 'approved' AND cp.deleted_at IS NULL`;
    const params = [input.status];
    if (input.companyProfileId) {
        whereClause += ' AND p.company_profile_id = ?';
        params.push(input.companyProfileId);
    }
    return {
        sql: `SELECT
         p.id,
         p.title,
         p.description,
         p.style,
         p.location,
         p.area,
         p.year,
         p.cost,
         p.images,
         p.tags,
         p.created_at,
         cp.company_name as designer_name,
         cp.city as designer_city,
         cp.logo_url as designer_avatar,
         cp.description as designer_bio
       FROM projects p
       INNER JOIN company_profiles cp ON p.company_profile_id = cp.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT ${input.limit} OFFSET ${input.offset}`,
        params,
    };
}
