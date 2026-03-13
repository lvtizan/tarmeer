import assert from 'node:assert/strict';

function toComparableValue(value: unknown, fieldName: string) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      return asNumber;
    }

    const asDate = Date.parse(value);
    assert.equal(Number.isNaN(asDate), false, `${fieldName} must be numeric or date-like`);
    return asDate;
  }

  assert.fail(`${fieldName} must be numeric or date-like`);
}

export function assertDescendingNumberField(items: any[], fieldName: string) {
  for (let index = 1; index < items.length; index += 1) {
    const previous = Number(items[index - 1]?.[fieldName]);
    const current = Number(items[index]?.[fieldName]);

    assert.equal(Number.isFinite(previous), true, `${fieldName} must be numeric`);
    assert.equal(Number.isFinite(current), true, `${fieldName} must be numeric`);
    assert.equal(
      previous >= current,
      true,
      `${fieldName} must be in descending order`
    );
  }
}

export function assertDescendingComparableField(items: any[], fieldName: string) {
  for (let index = 1; index < items.length; index += 1) {
    const previous = toComparableValue(items[index - 1]?.[fieldName], fieldName);
    const current = toComparableValue(items[index]?.[fieldName], fieldName);

    assert.equal(
      previous >= current,
      true,
      `${fieldName} must be in descending order`
    );
  }
}

export function assertPaginationMatchesRequest(
  payload: { pagination?: { page?: number; limit?: number; [key: string]: unknown } },
  request: { page: number; limit: number }
) {
  assert.equal(
    payload?.pagination?.page,
    request.page,
    'pagination.page must match requested page'
  );
  assert.equal(
    payload?.pagination?.limit,
    request.limit,
    'pagination.limit must match requested limit'
  );
}

export function assertCrossPageDescendingBoundary(
  pageOneItems: any[],
  pageTwoItems: any[],
  fieldName: string
) {
  if (pageOneItems.length === 0 || pageTwoItems.length === 0) {
    return;
  }

  const previous = Number(pageOneItems[pageOneItems.length - 1]?.[fieldName]);
  const current = Number(pageTwoItems[0]?.[fieldName]);

  assert.equal(Number.isFinite(previous), true, `${fieldName} must be numeric`);
  assert.equal(Number.isFinite(current), true, `${fieldName} must be numeric`);
  assert.equal(
    previous >= current,
    true,
    `${fieldName} must stay in descending order across pages`
  );
}

export function assertNoOverlappingIds(
  pageOneItems: Array<{ id: string | number }>,
  pageTwoItems: Array<{ id: string | number }>
) {
  const pageOneIds = new Set(pageOneItems.map((item) => String(item.id)));
  const overlappingIds = pageTwoItems
    .map((item) => String(item.id))
    .filter((id) => pageOneIds.has(id));

  assert.deepEqual(overlappingIds, [], 'duplicate ids across pages are not allowed');
}

export function collectSmokeSampleIds(
  pageOneItems: Array<{ id: string | number }>,
  pageTwoItems: Array<{ id: string | number }>,
  maxSamples: number
) {
  const result: string[] = [];
  const prioritized = [
    pageOneItems[0],
    pageTwoItems[0],
    ...pageOneItems.slice(1),
    ...pageTwoItems.slice(1),
  ].filter(Boolean) as Array<{ id: string | number }>;

  for (const item of prioritized) {
    const id = String(item.id);
    if (!result.includes(id)) {
      result.push(id);
    }
    if (result.length >= maxSamples) {
      break;
    }
  }

  return result;
}
