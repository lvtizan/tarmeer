"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DESIGNER_IDS_REQUIRED_ERROR = void 0;
exports.buildAutoPublishPendingProjectsQuery = buildAutoPublishPendingProjectsQuery;
exports.DESIGNER_IDS_REQUIRED_ERROR = 'DESIGNER_IDS_REQUIRED';
function buildAutoPublishPendingProjectsQuery(designerIds) {
    if (!Array.isArray(designerIds) || designerIds.length === 0) {
        throw new Error(exports.DESIGNER_IDS_REQUIRED_ERROR);
    }
    const placeholders = designerIds.map(() => '?').join(',');
    return {
        sql: `UPDATE projects
       SET status = 'published', rejection_reason = NULL, updated_at = NOW()
       WHERE designer_id IN (${placeholders}) AND status = 'pending'`,
        params: designerIds,
    };
}
