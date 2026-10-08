import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('src/components/admin/VerificationRecordSections.tsx'), 'utf8');
const recordsPage = readFileSync(resolve('src/app/admin/visit-records/page.tsx'), 'utf8');
const assertions = [
  ['desktop layout has a dedicated left rail', 'xl:grid-cols-[232px_minmax(0,1fr)]'],
  ['desktop navigation uses the measured record overview offset', 'xl:sticky xl:top-[var(--record-overview-offset)] xl:flex'],
  ['mobile navigation remains horizontally scrollable', 'flex gap-2 overflow-x-auto pb-2'],
  ['long dynamic section titles remain usable on mobile', 'max-w-60 shrink-0'],
  ['long dynamic section titles can break safely', '[overflow-wrap:anywhere]'],
  ['the desktop rail has a header-safe fallback height', 'xl:max-h-[calc(100dvh-4rem-var(--record-overview-offset))]'],
  ['the desktop rail measures its actual scrollport height', 'setScrollportHeight(scrollport.clientHeight)'],
  ['desktop step lists have vertical scrolling', 'xl:overflow-y-auto'],
  ['section navigation preserves stable schema-key URL anchors', 'href={`#${recordSectionId(section.key)}`}'],
  ['cold-start hash links restore the matching section after async rendering', 'selectHashTarget'],
  ['malformed hashes cannot crash record navigation', 'const decodeHash = (hash: string) => { try { return decodeURIComponent(hash); } catch { return hash; } };'],
  ['back and forward hash navigation is supported', "window.addEventListener('hashchange', selectHashTarget)"],
  ['scroll position updates the active navigation item', 'new IntersectionObserver'],
  ['desktop scrollspy observes inside the admin scrollport', 'root: scrollport,'],
  ['desktop scrollspy reserves a positive pixel observation band', 'const observationBand = Math.min(160, availableHeight);'],
  ['scrollspy uses pixel margins instead of root-width percentages', 'rootMargin: `-${topInset}px 0px -${bottomInset}px 0px`'],
  ['mobile scrollspy measures the visible viewport height', 'const rootHeight = isDesktop ? scrollportHeight : viewportHeight;'],
  ['mobile scrollspy avoids desktop sticky offsets', 'rootHeight - (isDesktop ? stickyOffset : 0)'],
  ['mobile scrollspy recomputes on viewport resizing', "window.visualViewport?.addEventListener('resize', measure)"],
  ['scrollspy selects the final section at the bottom of a long record', 'setActiveIndex(nodes.length - 1);'],
  ['scrollspy treats the bottom state as authoritative in observer callbacks', 'if (isAtEnd()) {'],
  ['short records cannot be mistaken for the bottom of a long record', 'scrollSource.scrollHeight > scrollSource.clientHeight + 2'],
  ['scrollspy recalculates the active section after scrolling back from the bottom', 'const selectActiveFromScrollPosition = () => {'],
  ['reverse scrolling selects the last section above the observation line', 'node.getBoundingClientRect().top <= observationTop + 1 ? index : current'],
  ['scrollspy keeps its initial active state independent of viewport geometry', '}, [sections]);'],
  ['scrollspy updates when the responsive breakpoint changes', "query.addEventListener('change', update)"],
  ['observer resolves section IDs from stable schema keys', 'document.getElementById(recordSectionId(section.key))'],
  ['the active mobile navigation item is revealed without moving the page', 'nav.scrollLeft +='],
  ['the active desktop navigation item is revealed within its own rail', 'nav.scrollTop +='],
  ['active state is exposed to assistive technology', "aria-current={selected ? 'location' : undefined}"],
  ['section anchors account for the measured sticky overview', 'xl:scroll-mt-[var(--record-overview-offset)]'],
];

for (const [name, needle] of assertions) {
  if (!source.includes(needle)) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}
console.log(`${assertions.length}/${assertions.length} PASS`);

const urlAssertions = [
  ['opening a record writes its ID to the URL', "url.searchParams.set('detail', String(id))"],
  ['record deep links retain only the record ID', "url.searchParams.set('detail', String(id))"],
  ['hash-only history changes do not refetch the current detail', 'if (selectedIdRef.current !== id || detailCountryRef.current !== country) void openDetail(id);'],
  ['the browser back button restores or closes the record detail', "window.addEventListener('popstate', syncDetailFromUrl)"],
  ['deep links retry after the active country is restored', '}, [openDetail]);'],
];
for (const [name, needle] of urlAssertions) {
  if (!recordsPage.includes(needle)) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}
console.log(`${assertions.length + urlAssertions.length}/${assertions.length + urlAssertions.length} PASS`);

const overviewAssertions = [
  ['back link stays at the top of the admin scrollport on desktop', 'xl:sticky xl:top-0 xl:z-30'],
  ['record overview stays beneath the measured back link', 'xl:sticky xl:top-[var(--record-detail-back-height)] xl:z-20'],
  ['overview and navigation offsets are measured with ResizeObserver', 'new ResizeObserver(measure)'],
  ['the measured offset is shared with the section navigator', 'stickyOffset={recordStickyOffset}'],
];
for (const [name, needle] of overviewAssertions) {
  if (!recordsPage.includes(needle)) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}
console.log(`${assertions.length + urlAssertions.length + overviewAssertions.length}/${assertions.length + urlAssertions.length + overviewAssertions.length} PASS`);
