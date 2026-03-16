type BuildAdminDesignersListQueryParams = {
  whereClause: string;
  safeSortBy: string;
  safeSortOrder: 'ASC' | 'DESC';
  safeLimit: number;
  offset: number;
};

export function buildAdminDesignersListQuery({
  whereClause,
  safeSortBy,
  safeSortOrder,
  safeLimit,
  offset,
}: BuildAdminDesignersListQueryParams) {
  const orderBy = safeSortBy === 'profile_views' ? 'total_profile_views' : `d.${safeSortBy}`;

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
        d.deleted_by_admin_id,
        d.delete_reason,
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
