import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getProjectStatusForDesignerSubmit,
  isProjectVisibleToPublic,
  canAdminReviewProject,
} from './projectReview';

test('returns draft when designer saves project without publishing', () => {
  assert.equal(getProjectStatusForDesignerSubmit(false), 'draft');
});

test('returns pending when designer submits project for review', () => {
  assert.equal(getProjectStatusForDesignerSubmit(true), 'pending');
});

test('only published projects are visible to public', () => {
  assert.equal(isProjectVisibleToPublic('published'), true);
  assert.equal(isProjectVisibleToPublic('pending'), false);
  assert.equal(isProjectVisibleToPublic('draft'), false);
  assert.equal(isProjectVisibleToPublic('rejected'), false);
});

test('only pending projects can be reviewed by admin', () => {
  assert.equal(canAdminReviewProject('pending'), true);
  assert.equal(canAdminReviewProject('draft'), false);
  assert.equal(canAdminReviewProject('published'), false);
  assert.equal(canAdminReviewProject('rejected'), false);
});
