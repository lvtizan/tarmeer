const VIEWPORT_BOTTOM_GAP = 24;
const MIN_FLYOUT_HEIGHT = 240;

export function getMegaMenuFlyoutPlacement({
  menuTop,
  rowTop,
  viewportHeight,
}: {
  menuTop: number;
  rowTop: number;
  viewportHeight: number;
}) {
  const maxTop = Math.max(0, viewportHeight - menuTop - VIEWPORT_BOTTOM_GAP - MIN_FLYOUT_HEIGHT);
  const top = Math.min(Math.max(0, rowTop - menuTop), maxTop);

  return {
    top,
    maxHeight: Math.max(0, viewportHeight - (menuTop + top) - VIEWPORT_BOTTOM_GAP),
    minHeight: Math.min(MIN_FLYOUT_HEIGHT, Math.max(0, viewportHeight - (menuTop + top) - VIEWPORT_BOTTOM_GAP)),
  };
}
