import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');
const [sidebar, library] = await Promise.all([
  read('src/components/shared/FilterSidebar.tsx'),
  read('src/components/materials/SupplierProductLibrary.tsx'),
]);

assert.match(library, /desktopFixed/);
assert.match(library, /desktopFixedTop=\{200\}/);
assert.match(sidebar, /window\.addEventListener\('scroll', scheduleUpdate, \{ passive: true \}\)/);
assert.match(sidebar, /window\.addEventListener\('resize', scheduleUpdate\)/);
assert.match(sidebar, /shouldPinDesktopSidebar/);
assert.match(sidebar, /position: 'fixed'/);
assert.match(sidebar, /const nextStyle: React\.CSSProperties = \{[\s\S]*top: desktopFixedTop/);
assert.match(sidebar, /window\.requestAnimationFrame/);
assert.match(sidebar, /window\.cancelAnimationFrame/);
assert.match(sidebar, /new ResizeObserver\(scheduleUpdate\)/);
assert.match(sidebar, /resizeObserver\.disconnect\(\)/);
assert.match(sidebar, /window\.removeEventListener\('scroll', scheduleUpdate\)/);
assert.match(sidebar, /if \(!desktopFixed\) \{/);

console.log('supplier-library-sidebar: 13/13 PASS');
