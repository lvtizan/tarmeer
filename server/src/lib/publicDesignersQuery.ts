interface BuildPublicDesignersListQueryInput {
  limit: number;
  offset: number;
}

export function buildPublicDesignersListQuery(input: BuildPublicDesignersListQueryInput) {
  return {
    sql: `SELECT
         id,
         full_name,
         title,
         city,
         bio,
         avatar_url,
         style,
         expertise,
         display_order,
         created_at,
         (SELECT COUNT(*) FROM projects p WHERE p.designer_id = designers.id AND p.status = 'published') as project_count,
         (SELECT images FROM projects p WHERE p.designer_id = designers.id AND p.status = 'published' ORDER BY p.created_at DESC LIMIT 1) as featured_project_images
       FROM designers WHERE status = 'approved' AND is_approved = 1
       ORDER BY display_order DESC, created_at DESC
       LIMIT ${input.limit} OFFSET ${input.offset}`,
    params: [] as string[],
  };
}
