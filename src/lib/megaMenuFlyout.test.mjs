import test from 'node:test';
import assert from 'node:assert/strict';
import { getMegaMenuFlyoutPlacement } from './megaMenuFlyout.ts';

test('aligns a flyout with an active category row when it fits in the viewport', () => {
  assert.deepEqual(
    getMegaMenuFlyoutPlacement({ menuTop: 96, rowTop: 452, viewportHeight: 900 }),
    { top: 356, maxHeight: 424, minHeight: 240 },
  );
});

test('caps the short-content hover bridge without expanding it to the full viewport', () => {
  const placement = getMegaMenuFlyoutPlacement({ menuTop: 96, rowTop: 96, viewportHeight: 900 });
  assert.equal(placement.maxHeight, 780);
  assert.equal(placement.minHeight, 240);
});

test('keeps a lower category flyout inside the viewport while retaining a reachable row', () => {
  assert.deepEqual(
    getMegaMenuFlyoutPlacement({ menuTop: 96, rowTop: 796, viewportHeight: 900 }),
    { top: 540, maxHeight: 240, minHeight: 240 },
  );
});
