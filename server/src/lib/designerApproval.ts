export const DESIGNER_IDS_REQUIRED_ERROR = 'DESIGNER_IDS_REQUIRED';

export function buildAutoPublishPendingProjectsQuery(designerIds: number[]) {
  if (!Array.isArray(designerIds) || designerIds.length === 0) {
    throw new Error(DESIGNER_IDS_REQUIRED_ERROR);
  }

  const placeholders = designerIds.map(() => '?').join(',');

  return {
    sql: `UPDATE projects
       SET status = 'published', rejection_reason = NULL, updated_at = NOW()
       WHERE designer_id IN (${placeholders}) AND status = 'pending'`,
    params: designerIds,
  };
}

