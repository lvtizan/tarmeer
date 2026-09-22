export function shouldPinDesktopSidebar({
  scrollY,
  anchorTop,
  parentBottom,
  fixedTop,
  panelHeight,
  viewportHeight,
}: {
  scrollY: number;
  anchorTop: number;
  parentBottom: number;
  fixedTop: number;
  panelHeight: number;
  viewportHeight: number;
}) {
  const availableHeight = Math.max(0, viewportHeight - fixedTop - 16);
  return scrollY + fixedTop >= anchorTop
    && parentBottom > fixedTop + Math.min(panelHeight, availableHeight);
}
