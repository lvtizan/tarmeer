export function shouldCloseMegaMenu({
  isFocusMove,
  hasFocusWithin,
  nextFocusWithin,
}: {
  isFocusMove: boolean;
  hasFocusWithin: boolean;
  nextFocusWithin: boolean;
}) {
  return isFocusMove ? !nextFocusWithin : !hasFocusWithin;
}

export function shouldReturnToCategoryFromFlyout({
  isShiftTab,
  isFlyoutRoot,
}: {
  isShiftTab: boolean;
  isFlyoutRoot: boolean;
}) {
  return isShiftTab && isFlyoutRoot;
}
