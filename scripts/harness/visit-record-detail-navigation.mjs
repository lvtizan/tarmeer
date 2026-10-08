import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('src/components/admin/VerificationRecordSections.tsx'), 'utf8');
const recordsPage = readFileSync(resolve('src/app/admin/visit-records/page.tsx'), 'utf8');
const assertions = [
  ['desktop layout has a dedicated left rail', 'xl:grid-cols-[232px_minmax(0,1fr)]'],
  ['desktop navigation is sticky', 'xl:sticky xl:top-24 xl:flex'],
  ['mobile navigation remains horizontally scrollable', 'flex gap-2 overflow-x-auto pb-2'],
  ['long dynamic section titles remain usable on mobile', 'max-w-60 shrink-0'],
  ['long dynamic section titles can break safely', '[overflow-wrap:anywhere]'],
  ['the entire desktop rail fits inside the admin scrollport', 'xl:max-h-[calc(100dvh-10rem)]'],
  ['desktop step lists have vertical scrolling', 'xl:overflow-y-auto'],
  ['section navigation preserves stable schema-key URL anchors', 'href={`#${recordSectionId(section.key)}`}'],
  ['cold-start hash links restore the matching section after async rendering', 'selectHashTarget'],
  ['malformed hashes cannot crash record navigation', 'const decodeHash = (hash: string) => { try { return decodeURIComponent(hash); } catch { return hash; } };'],
  ['back and forward hash navigation is supported', "window.addEventListener('hashchange', selectHashTarget)"],
  ['scroll position updates the active navigation item', 'new IntersectionObserver'],
  ['observer resolves section IDs from stable schema keys', 'document.getElementById(recordSectionId(section.key))'],
  ['the active mobile navigation item is revealed without moving the page', 'nav.scrollLeft +='],
  ['the active desktop navigation item is revealed within its own rail', 'nav.scrollTop +='],
  ['active state is exposed to assistive technology', "aria-current={selected ? 'location' : undefined}"],
  ['section anchors account for the sticky application header', 'scroll-mt-24'],
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
