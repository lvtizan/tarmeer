"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjectStatusForDesignerSubmit = getProjectStatusForDesignerSubmit;
exports.isProjectVisibleToPublic = isProjectVisibleToPublic;
exports.canAdminReviewProject = canAdminReviewProject;
function getProjectStatusForDesignerSubmit(publish) {
    return publish ? 'pending' : 'draft';
}
function isProjectVisibleToPublic(status) {
    return status === 'published';
}
function canAdminReviewProject(status) {
    return status === 'pending';
}
