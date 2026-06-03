"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeDesignerDeleteFilter = normalizeDesignerDeleteFilter;
exports.buildDesignerAdminWhereClause = buildDesignerAdminWhereClause;
exports.validateDeleteReason = validateDeleteReason;
function normalizeDesignerDeleteFilter(value) {
    if (value === 'deleted' || value === 'all') {
        return value;
    }
    return 'active';
}
function buildDesignerAdminWhereClause(input) {
    const values = [];
    const conditions = [];
    const deletedFilter = normalizeDesignerDeleteFilter(input.deleted);
    if (input.status && ['pending', 'approved', 'rejected'].includes(input.status)) {
        conditions.push('d.status = ?');
        values.push(input.status);
    }
    if (input.search) {
        conditions.push('(d.full_name LIKE ? OR d.email LIKE ? OR d.city LIKE ?)');
        const searchPattern = `%${input.search}%`;
        values.push(searchPattern, searchPattern, searchPattern);
    }
    if (deletedFilter === 'active') {
        conditions.push('d.deleted_at IS NULL');
    }
    else if (deletedFilter === 'deleted') {
        conditions.push('d.deleted_at IS NOT NULL');
    }
    return {
        deletedFilter,
        values,
        whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    };
}
function validateDeleteReason(reason) {
    const trimmed = reason?.trim();
    if (!trimmed) {
        return null;
    }
    return trimmed;
}
