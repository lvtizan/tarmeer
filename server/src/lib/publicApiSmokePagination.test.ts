import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertDescendingNumberField,
  assertDescendingComparableField,
  assertPaginationMatchesRequest,
  assertCrossPageDescendingBoundary,
  assertNoOverlappingIds,
  collectSmokeSampleIds,
} from './publicApiSmokePagination';

test('assertDescendingNumberField accepts descending numeric items', () => {
  assert.doesNotThrow(() => {
    assertDescendingNumberField(
      [
        { id: 1, display_order: 7 },
        { id: 2, display_order: 6 },
        { id: 3, display_order: 5 },
      ],
      'display_order'
    );
  });
});

test('assertDescendingNumberField reports the specific field when order breaks', () => {
  assert.throws(
    () =>
      assertDescendingNumberField(
        [
          { id: 1, display_order: 5 },
          { id: 2, display_order: 7 },
        ],
        'display_order'
      ),
    /display_order/
  );
});

test('assertPaginationMatchesRequest validates requested page metadata', () => {
  assert.doesNotThrow(() => {
    assertPaginationMatchesRequest(
      {
        pagination: {
          page: 2,
          limit: 3,
          total: 7,
          totalPages: 3,
        },
      },
      { page: 2, limit: 3 }
    );
  });
});

test('assertPaginationMatchesRequest reports page mismatch clearly', () => {
  assert.throws(
    () =>
      assertPaginationMatchesRequest(
        {
          pagination: {
            page: 1,
            limit: 3,
            total: 7,
            totalPages: 3,
          },
        },
        { page: 2, limit: 3 }
      ),
    /pagination\.page/
  );
});

test('assertPaginationMatchesRequest reports limit mismatch clearly', () => {
  assert.throws(
    () =>
      assertPaginationMatchesRequest(
        {
          pagination: {
            page: 2,
            limit: 2,
            total: 7,
            totalPages: 3,
          },
        },
        { page: 2, limit: 3 }
      ),
    /pagination\.limit/
  );
});

test('assertCrossPageDescendingBoundary accepts continuous descending pages', () => {
  assert.doesNotThrow(() => {
    assertCrossPageDescendingBoundary(
      [{ display_order: 7 }, { display_order: 6 }, { display_order: 5 }],
      [{ display_order: 4 }, { display_order: 3 }, { display_order: 2 }],
      'display_order'
    );
  });
});

test('assertCrossPageDescendingBoundary reports broken page boundary', () => {
  assert.throws(
    () =>
      assertCrossPageDescendingBoundary(
        [{ display_order: 7 }, { display_order: 6 }, { display_order: 5 }],
        [{ display_order: 8 }, { display_order: 3 }, { display_order: 2 }],
        'display_order'
      ),
    /display_order/
  );
});

test('assertDescendingComparableField accepts descending ISO timestamps', () => {
  assert.doesNotThrow(() => {
    assertDescendingComparableField(
      [
        { created_at: '2026-03-13T12:00:00.000Z' },
        { created_at: '2026-03-13T11:00:00.000Z' },
        { created_at: '2026-03-13T10:00:00.000Z' },
      ],
      'created_at'
    );
  });
});

test('assertDescendingComparableField reports field name when timestamps are out of order', () => {
  assert.throws(
    () =>
      assertDescendingComparableField(
        [
          { created_at: '2026-03-13T10:00:00.000Z' },
          { created_at: '2026-03-13T11:00:00.000Z' },
        ],
        'created_at'
      ),
    /created_at/
  );
});

test('assertNoOverlappingIds accepts distinct pages', () => {
  assert.doesNotThrow(() => {
    assertNoOverlappingIds(
      [{ id: 1 }, { id: 2 }, { id: 3 }],
      [{ id: 4 }, { id: 5 }, { id: 6 }]
    );
  });
});

test('assertNoOverlappingIds reports duplicate ids across pages', () => {
  assert.throws(
    () =>
      assertNoOverlappingIds(
        [{ id: 1 }, { id: 2 }, { id: 3 }],
        [{ id: 3 }, { id: 4 }, { id: 5 }]
      ),
    /duplicate ids across pages/
  );
});

test('collectSmokeSampleIds merges pages and keeps unique ids in order', () => {
  const result = collectSmokeSampleIds(
    [{ id: 110 }, { id: 109 }, { id: 108 }],
    [{ id: 108 }, { id: 107 }, { id: 106 }],
    4
  );

  assert.deepEqual(result, ['110', '108', '109', '107']);
});

test('collectSmokeSampleIds includes a second-page sample when available', () => {
  const result = collectSmokeSampleIds(
    [{ id: 110 }, { id: 109 }, { id: 108 }],
    [{ id: 107 }, { id: 106 }, { id: 105 }],
    2
  );

  assert.deepEqual(result, ['110', '107']);
});

test('collectSmokeSampleIds falls back to second page when first page is empty', () => {
  const result = collectSmokeSampleIds(
    [],
    [{ id: 107 }, { id: 106 }, { id: 105 }],
    2
  );

  assert.deepEqual(result, ['107', '106']);
});
