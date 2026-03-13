import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertPublicDesignersPayload,
  assertPublicDesignerDetailPayload,
  assertPublicProjectsPayload,
  assertPublicProjectDetailPayload,
} from './publicApiSmoke';

test('assertPublicDesignersPayload accepts valid public designers payload', () => {
  assert.doesNotThrow(() => {
    assertPublicDesignersPayload({
      designers: [
        {
          id: 110,
          full_name: 'Hassan Mostafa',
          title: '',
          city: 'Ajman',
          bio: 'Budget-friendly design and space planning.',
          avatar_url: 'https://example.com/avatar.jpg',
          style: 'Modern',
          expertise: ['Residential'],
          featured_images: ['https://example.com/image.jpg'],
          featured_project_images: ['https://example.com/image.jpg'],
          project_count: 1,
          display_order: 7,
          created_at: '2026-03-13T04:12:37.000Z',
        },
      ],
      pagination: {
        page: 1,
        limit: 3,
        total: 7,
        totalPages: 3,
      },
    });
  });
});

test('assertPublicDesignersPayload throws when list designer metadata is missing', () => {
  assert.throws(
    () => {
      assertPublicDesignersPayload({
        designers: [
          {
            id: 110,
            full_name: 'Hassan Mostafa',
            expertise: ['Residential'],
            featured_images: ['https://example.com/image.jpg'],
            featured_project_images: ['https://example.com/image.jpg'],
            project_count: 1,
            display_order: 7,
          },
        ],
        pagination: {
          page: 1,
          limit: 3,
          total: 7,
          totalPages: 3,
        },
      });
    },
    /title/
  );
});

test('assertPublicProjectsPayload accepts valid public projects payload', () => {
  assert.doesNotThrow(() => {
    assertPublicProjectsPayload({
      projects: [
        {
          id: 17,
          title: 'Marina Heights Apartment',
          description: 'Full renovation',
          designer_name: 'Youssef Ali',
          designer_city: 'Dubai',
          designer_avatar: 'https://example.com/avatar.jpg',
          designer_bio: 'Award-winning designer.',
          images: ['https://example.com/image.jpg'],
          tags: ['Residential'],
        },
      ],
      pagination: {
        page: 1,
        limit: 1,
        total: 8,
        totalPages: 8,
      },
    });
  });
});

test('assertPublicProjectsPayload throws when list designer metadata is missing', () => {
  assert.throws(
    () => {
      assertPublicProjectsPayload({
        projects: [
          {
            id: 17,
            title: 'Marina Heights Apartment',
            description: 'Full renovation',
            images: ['https://example.com/image.jpg'],
            tags: ['Residential'],
          },
        ],
        pagination: {
          page: 1,
          limit: 1,
          total: 8,
          totalPages: 8,
        },
      });
    },
    /designer_name/
  );
});

test('assertPublicDesignerDetailPayload validates detail contract', () => {
  assert.doesNotThrow(() => {
    assertPublicDesignerDetailPayload({
      designer: {
        id: 110,
        full_name: 'Hassan Mostafa',
        title: '',
        city: 'Ajman',
        bio: 'Budget-friendly design and space planning.',
        avatar_url: 'https://example.com/avatar.jpg',
        style: 'Modern',
        expertise: ['Residential'],
        featured_images: ['https://example.com/image.jpg'],
        featured_project_images: ['https://example.com/image.jpg'],
        project_count: 1,
        display_order: 7,
        created_at: '2026-03-13T04:12:37.000Z',
      },
      projects: [
        {
          id: 24,
          title: 'Studio Apartment JLT',
          description: 'Compact studio.',
          designer_name: 'Hassan Mostafa',
          designer_city: 'Ajman',
          designer_avatar: 'https://example.com/avatar.jpg',
          designer_bio: 'Budget-friendly design and space planning.',
          images: ['https://example.com/image.jpg'],
          tags: ['Studio'],
        },
      ],
    });
  });
});

test('assertPublicProjectDetailPayload validates single project detail contract', () => {
  assert.doesNotThrow(() => {
    assertPublicProjectDetailPayload({
      project: {
        id: 17,
        title: 'Marina Heights Apartment',
        description: 'Full renovation',
        designer_name: 'Youssef Ali',
        designer_city: 'Dubai',
        designer_avatar: 'https://example.com/avatar.jpg',
        designer_bio: 'Award-winning designer.',
        images: ['https://example.com/image.jpg'],
        tags: ['Residential'],
      },
    });
  });
});

test('assertPublicDesignerDetailPayload throws when detail-only designer fields are missing', () => {
  assert.throws(
    () => {
      assertPublicDesignerDetailPayload({
        designer: {
          id: 110,
          full_name: 'Hassan Mostafa',
          expertise: ['Residential'],
          featured_images: ['https://example.com/image.jpg'],
          featured_project_images: ['https://example.com/image.jpg'],
          project_count: 1,
          display_order: 7,
        },
        projects: [],
      });
    },
    /title/
  );
});

test('assertPublicProjectDetailPayload throws when designer metadata is missing', () => {
  assert.throws(
    () => {
      assertPublicProjectDetailPayload({
        project: {
          id: 17,
          title: 'Marina Heights Apartment',
          description: 'Full renovation',
          images: ['https://example.com/image.jpg'],
          tags: ['Residential'],
        },
      });
    },
    /designer_name/
  );
});
