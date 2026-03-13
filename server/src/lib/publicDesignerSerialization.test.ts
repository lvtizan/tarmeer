import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizePublicDesigner,
  sanitizePublicProject,
} from './publicDesignerSerialization';

test('sanitizePublicDesigner keeps both featured image fields in sync and strips seed avatars', () => {
  const result = sanitizePublicDesigner({
    id: 7,
    full_name: 'Nadia Kareem',
    title: 'Senior Interior Designer',
    city: 'Dubai',
    bio: 'Focuses on warm modern interiors.',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop',
    style: 'Warm Modern',
    expertise: '["Lighting","Joinery"]',
    display_order: 12,
    project_count: 5,
    featured_project_images: '["https://example.com/cover.jpg?w=800","https://example.com/cover.jpg?w=1200","https://example.com/detail.jpg"]',
    created_at: '2026-03-01T00:00:00.000Z',
  });

  assert.deepEqual(result.featured_images, ['https://example.com/cover.jpg?w=800', 'https://example.com/detail.jpg']);
  assert.deepEqual(result.featured_project_images, ['https://example.com/cover.jpg?w=800', 'https://example.com/detail.jpg']);
  assert.equal(result.project_count, 5);
  assert.equal(result.avatar_url, '');
  assert.deepEqual(result.expertise, ['Lighting', 'Joinery']);
});

test('sanitizePublicDesigner normalizes nullable public strings to empty strings', () => {
  const result = sanitizePublicDesigner({
    id: 8,
    full_name: null,
    title: null,
    city: null,
    bio: null,
    avatar_url: null,
    style: null,
    expertise: null,
    display_order: 0,
    project_count: 0,
    featured_project_images: null,
    created_at: null,
  });

  assert.equal(result.full_name, '');
  assert.equal(result.title, '');
  assert.equal(result.city, '');
  assert.equal(result.bio, '');
  assert.equal(result.avatar_url, '');
  assert.equal(result.style, '');
  assert.equal(result.created_at, '');
  assert.deepEqual(result.expertise, []);
  assert.deepEqual(result.featured_images, []);
  assert.deepEqual(result.featured_project_images, []);
});

test('sanitizePublicProject preserves description and returns unique image arrays', () => {
  const result = sanitizePublicProject({
    id: 3,
    title: 'Palm Villa',
    description: 'A full villa renovation.',
    style: 'Modern',
    location: 'Palm Jumeirah',
    area: '350 sqm',
    year: '2025',
    cost: '400,000 AED',
    images: '["https://example.com/1.jpg?w=800","https://example.com/1.jpg?w=1200","https://example.com/2.jpg","","   "]',
    tags: '["Villa","Luxury"]',
    created_at: '2026-03-02T00:00:00.000Z',
  });

  assert.equal(result.description, 'A full villa renovation.');
  assert.deepEqual(result.images, [
    'https://example.com/1.jpg?w=800',
    'https://example.com/2.jpg',
  ]);
  assert.deepEqual(result.tags, ['Villa', 'Luxury']);
});

test('sanitizePublicProject strips seed designer avatars and keeps designer metadata', () => {
  const result = sanitizePublicProject({
    id: 9,
    title: 'Marina Heights Apartment',
    description: 'Full renovation and soft furnishing.',
    style: 'Contemporary',
    location: 'Dubai Marina',
    area: '180 sqm',
    year: '2024',
    cost: 'AED 320,000',
    images: '["https://example.com/1.jpg?w=800","https://example.com/1.jpg?w=1200"]',
    tags: '["Residential","Renovation"]',
    designer_name: 'Youssef Ali',
    designer_city: 'Dubai',
    designer_avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop',
    designer_bio: 'Award-winning designer.',
    created_at: '2026-03-02T00:00:00.000Z',
  });

  assert.deepEqual(result.images, ['https://example.com/1.jpg?w=800']);
  assert.equal(result.designer_name, 'Youssef Ali');
  assert.equal(result.designer_city, 'Dubai');
  assert.equal(result.designer_avatar, '');
  assert.equal(result.designer_bio, 'Award-winning designer.');
});

test('sanitizePublicProject normalizes nullable public strings to empty strings', () => {
  const result = sanitizePublicProject({
    id: 10,
    title: 'Sample Project',
    description: null,
    style: null,
    location: null,
    area: null,
    year: null,
    cost: null,
    images: null,
    tags: null,
    designer_name: 'Designer Name',
    designer_city: null,
    designer_avatar: null,
    designer_bio: null,
    created_at: '2026-03-02T00:00:00.000Z',
  });

  assert.equal(result.description, '');
  assert.equal(result.style, '');
  assert.equal(result.location, '');
  assert.equal(result.area, '');
  assert.equal(result.year, '');
  assert.equal(result.cost, '');
  assert.equal(result.designer_city, '');
  assert.equal(result.designer_avatar, '');
  assert.equal(result.designer_bio, '');
  assert.deepEqual(result.images, []);
  assert.deepEqual(result.tags, []);
});
