import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHomeownerRecentProjects } from './homeownerProjectSerialization';

test('normalizeHomeownerRecentProjects normalizes image paths and keeps only renderable urls', () => {
  const result = normalizeHomeownerRecentProjects([
    {
      id: 1,
      title: 'Project A',
      image_urls: JSON.stringify([
        'images/uae-companies/portfolio/a/1.jpg',
        'https://cdn.example.com/p2.jpg',
        'not-a-url',
      ]),
    },
  ]);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0].images, [
    '/images/uae-companies/portfolio/a/1.jpg',
    'https://cdn.example.com/p2.jpg',
  ]);
});

test('normalizeHomeownerRecentProjects supports legacy images field and relative uploads', () => {
  const result = normalizeHomeownerRecentProjects([
    {
      id: 2,
      title: 'Project B',
      images: ['uploads/projects/p3.jpg', './uploads/projects/p4.jpg'],
    },
  ]);

  assert.deepEqual(result[0].images, [
    '/uploads/projects/p3.jpg',
    '/uploads/projects/p4.jpg',
  ]);
});

