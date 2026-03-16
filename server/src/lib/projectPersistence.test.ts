import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectPersistenceValues } from './projectPersistence';

test('buildProjectPersistenceValues normalizes optional project fields for mysql bindings', () => {
  const result = buildProjectPersistenceValues({
    title: 'Sample Project',
    description: 'A test project',
    style: undefined,
    location: ' Dubai ',
    area: '',
    year: undefined,
    cost: undefined,
    images: ['a', 'b'],
    tags: undefined,
    status: 'pending',
  });

  assert.equal(result.style, null);
  assert.equal(result.location, 'Dubai');
  assert.equal(result.area, null);
  assert.equal(result.year, null);
  assert.equal(result.cost, null);
  assert.equal(result.images, JSON.stringify(['a', 'b']));
  assert.equal(result.tags, JSON.stringify([]));
  assert.equal(result.status, 'pending');
});
