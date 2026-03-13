interface BuildPublicProjectsListQueryInput {
  status: string;
  designerId?: string;
  limit: number;
  offset: number;
}

export function buildPublicProjectsListQuery(input: BuildPublicProjectsListQueryInput) {
  let whereClause = `WHERE p.status = ? AND d.status = 'approved' AND d.is_approved = 1`;
  const params: string[] = [input.status];

  if (input.designerId) {
    whereClause += ' AND p.designer_id = ?';
    params.push(input.designerId);
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
         d.full_name as designer_name,
         d.city as designer_city,
         d.avatar_url as designer_avatar,
         d.bio as designer_bio
       FROM projects p
       INNER JOIN designers d ON p.designer_id = d.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT ${input.limit} OFFSET ${input.offset}`,
    params,
  };
}
