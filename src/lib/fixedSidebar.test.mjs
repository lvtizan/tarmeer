import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldPinDesktopSidebar } from './fixedSidebar.ts';

const longLibrary = {
  anchorTop: 698,
  parentBottom: 13020,
  fixedTop: 200,
  panelHeight: 747,
  viewportHeight: 1114,
};

test('pins a long supplier material library after its Collections sidebar reaches the offset', () => {
  assert.equal(shouldPinDesktopSidebar({ ...longLibrary, scrollY: 499 }), true);
});

test('keeps Collections in normal document flow before it reaches the fixed offset', () => {
  assert.equal(shouldPinDesktopSidebar({ ...longLibrary, scrollY: 497 }), false);
});

test('releases Collections before the materials section ends', () => {
  assert.equal(shouldPinDesktopSidebar({ ...longLibrary, scrollY: 12000, parentBottom: 800 }), false);
});
