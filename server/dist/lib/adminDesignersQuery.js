"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAdminDesignersListQuery = buildAdminDesignersListQuery;
const ALLOWED_SORT_FIELDS = [
    'id',
    'email',
    'full_name',
    'phone',
    'city',
    'status',
    'is_approved',
    'display_order',
    'created_at',
    'updated_at',
    'profile_views',
];
const SORT_FIELD_MAPPING = {
    profile_views: 'total_profile_views',
};
function validateSortField(sortBy) {
    if (!ALLOWED_SORT_FIELDS.includes(sortBy)) {
        throw new Error(`Invalid sort field: ${sortBy}. Allowed fields: ${ALLOWED_SORT_FIELDS.join(', ')}`);
    }
    return SORT_FIELD_MAPPING[sortBy] || `d.${sortBy}`;
}
function buildAdminDesignersListQuery({ whereClause, safeSortBy, safeSortOrder, safeLimit, offset, }) {
    const orderBy = validateSortField(safeSortBy);
    return {
        sql: `SELECT
        d.id,
        d.email,
        d.full_name,
        d.phone,
        d.city,
        d.avatar_url,
        d.style,
        d.expertise,
        d.status,
        d.is_approved,
        d.display_order,
        d.rejection_reason,
        d.deleted_at,
        d.created_at,
        d.updated_at,
        COALESCE(SUM(ds.profile_views), 0) as total_profile_views,
        COALESCE(SUM(ds.contact_clicks), 0) as total_contact_clicks,
        (SELECT COUNT(*) FROM projects p WHERE p.designer_id = d.id) as project_count
      FROM designers d
      LEFT JOIN designer_stats ds ON d.id = ds.designer_id
      ${whereClause}
      GROUP BY d.id
      ORDER BY ${orderBy} ${safeSortOrder}
      LIMIT ${safeLimit} OFFSET ${offset}`,
    };
}
