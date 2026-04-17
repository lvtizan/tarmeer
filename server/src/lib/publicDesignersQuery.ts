interface BuildPublicDesignersListQueryInput {
  limit: number;
  offset: number;
}

export function buildPublicDesignersListQuery(input: BuildPublicDesignersListQueryInput) {
  return {
    sql: `SELECT
         cp.id,
         cp.company_name,
         cp.city,
         cp.description,
         cp.logo_url,
         cp.display_order,
         cp.created_at,
         (SELECT COUNT(*) FROM projects p WHERE p.company_profile_id = cp.id AND p.status = 'published') as project_count,
         (SELECT images FROM projects p WHERE p.company_profile_id = cp.id AND p.status = 'published' ORDER BY p.created_at DESC LIMIT 1) as featured_project_images
       FROM company_profiles cp WHERE cp.status = 'approved' AND cp.deleted_at IS NULL
       ORDER BY cp.display_order DESC, cp.created_at DESC
       LIMIT ${input.limit} OFFSET ${input.offset}`,
    params: [] as string[],
  };
}
