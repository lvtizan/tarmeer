import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldCloseMegaMenu, shouldReturnToCategoryFromFlyout } from './megaMenuFocus.ts';

test('mouse leaving keeps the mega menu open while focus remains inside', () => {
  assert.equal(shouldCloseMegaMenu({ isFocusMove: false, hasFocusWithin: true, nextFocusWithin: false }), false);
  assert.equal(shouldCloseMegaMenu({ isFocusMove: false, hasFocusWithin: false, nextFocusWithin: false }), true);
});

test('focus movement closes only after focus leaves the menu boundary', () => {
  assert.equal(shouldCloseMegaMenu({ isFocusMove: true, hasFocusWithin: true, nextFocusWithin: true }), false);
  assert.equal(shouldCloseMegaMenu({ isFocusMove: true, hasFocusWithin: true, nextFocusWithin: false }), true);
});

test('only Shift+Tab from the flyout container returns to its category', () => {
  assert.equal(shouldReturnToCategoryFromFlyout({ isShiftTab: true, isFlyoutRoot: true }), true);
  assert.equal(shouldReturnToCategoryFromFlyout({ isShiftTab: true, isFlyoutRoot: false }), false);
  assert.equal(shouldReturnToCategoryFromFlyout({ isShiftTab: false, isFlyoutRoot: true }), false);
});
