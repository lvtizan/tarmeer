export type ProjectReviewStatus = 'draft' | 'pending' | 'published' | 'rejected';

export function getProjectStatusForDesignerSubmit(publish: boolean): ProjectReviewStatus {
  return publish ? 'pending' : 'draft';
}

export function isProjectVisibleToPublic(status: string): boolean {
  return status === 'published';
}

export function canAdminReviewProject(status: string): boolean {
  return status === 'pending';
}
