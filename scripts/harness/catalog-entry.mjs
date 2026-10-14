import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = file => readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
const jsx = (type, props, key) => ({ type, props: props || {}, key });
const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
let count = 0;
function check(label, fn) { fn(); console.log('PASS ' + label); count++; }
function mount(data = { pages: 27, format: 'webp' }, ok = true, readerError = false) {
  const hooks = [], effects = [], requested = []; let cursor = 0, tree, readerImports = 0;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = initial; return [hooks[i], value => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value; }]; },
    useRef(initial) { const i=cursor++; return hooks[i] ||= {current:initial}; },
    useEffect(effect) { const i = cursor++; if (!(i in hooks)) { hooks[i] = true; effects.push(effect); } },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(read('src/components/materials/CatalogEntry.tsx'), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText, {
    exports, AbortController, fetch: async url => { requested.push(url); return {ok,json:async()=>data}; },
    require(name) {
      if (name === 'react/jsx-runtime') return {jsx,jsxs:jsx};
      if (name === 'react') return react;
      if (name === 'lucide-react') return {BookOpen:'book'};
      if (name.endsWith('/SmartImage')) return {default:'image'};
      if (name.endsWith('/imageUrl')) return {resolveImageUrl:value=>'/api'+value};
      if (name === './CatalogReader') { readerImports++; if (readerError) throw Error('Chunk unavailable'); return {default:'reader'}; }
      throw Error(name);
    },
  });
  const catalog = {id:17,title:'Original catalog',file_size:123};
  const root = exports.default({catalogs:[catalog]});
  const card = nodes(root).find(n=>typeof n.type === 'function');
  const render = () => { cursor=0; tree=card.type(card.props); return tree; };
  render(); const cleanup=effects.map(effect=>effect());
  return {render,nodes:()=>nodes(tree),requested,cleanup,catalog,get readerImports(){return readerImports;},allowReader(){readerError=false;}};
}
const ready = mount();
check('idle card does not import or mount the reader',()=>{assert.equal(ready.readerImports,0);assert(!ready.nodes().some(n=>n.type==='reader'));});
await new Promise(resolve=>setImmediate(resolve)); ready.render();
check('card fetches only small preview metadata',()=>assert.deepEqual(ready.requested,['/api/uploads/suppliers/catalogs/pages/17/manifest.json']));
check('page count comes from published metadata',()=>assert(ready.nodes().some(n=>n.props.children==='PDF · 27 pages')));
check('cover uses thumbnail rather than full page',()=>assert.equal(ready.nodes().find(n=>n.type==='image').props.src,'/api/uploads/suppliers/catalogs/pages/17/1-thumb.webp'));
const opening=ready.nodes().find(n=>n.type==='button').props.onClick(); ready.render();
check('reader chunk loading has inline feedback without blocking the page',()=>assert(ready.nodes().some(n=>n.type==='button'&&n.props['aria-busy']===true&&n.props.children==='Opening catalog…')));
await opening; ready.render();
check('View Catalog imports once and opens only its selected catalog in fullscreen',()=>{const n=ready.nodes().find(n=>n.type==='reader');assert.equal(ready.readerImports,1);assert.equal(n.props.initialFullscreen,true);assert.equal(n.props.catalogs[0],ready.catalog);});
ready.nodes().find(n=>n.type==='reader').props.onClose(); ready.render();
check('closing unmounts reader and keeps the card',()=>{assert(!ready.nodes().some(n=>n.type==='reader'));assert(ready.nodes().some(n=>n.type==='button'));});
const failed=mount({},false); await new Promise(resolve=>setImmediate(resolve)); failed.render();
check('missing preview remains explicit',()=>assert(failed.nodes().some(n=>n.props.children==='Preview unavailable. Open the reader to retry.')));
await failed.nodes().find(n=>n.type==='button').props.onClick();failed.render();
check('missing preview can still open the lazy reader',()=>assert(failed.nodes().some(n=>n.type==='reader')));
const brokenChunk=mount({pages:27},true,true);await brokenChunk.nodes().find(n=>n.type==='button').props.onClick();brokenChunk.render();
check('reader chunk failure shows retry feedback without opening a blank dialog',()=>{assert(brokenChunk.nodes().some(n=>n.props.role==='alert'));assert(!brokenChunk.nodes().some(n=>n.type==='reader'));assert.equal(brokenChunk.nodes().find(n=>n.type==='button').props['aria-busy'],false);});
brokenChunk.allowReader();await brokenChunk.nodes().find(n=>n.type==='button').props.onClick();brokenChunk.render();
check('reader chunk failure can retry successfully',()=>assert(brokenChunk.nodes().some(n=>n.type==='reader')));
const revision='a'.repeat(64); const versioned=mount({pages:3,dir:'revisions/'+revision,format:'jpg',rev:'a&b'});await new Promise(resolve=>setImmediate(resolve));versioned.render();
check('revision thumbnail stays under approved publication path',()=>assert.equal(versioned.nodes().find(n=>n.type==='image').props.src,`/api/uploads/suppliers/catalogs/pages/17/revisions/${revision}/1-thumb.jpg?r=a%26b`));
const unsafe=mount({pages:3,dir:'https://bad.example/image',format:'png'});await new Promise(resolve=>setImmediate(resolve));unsafe.render();
check('untrusted directory and format cannot change thumbnail origin',()=>assert.equal(unsafe.nodes().find(n=>n.type==='image').props.src,'/api/uploads/suppliers/catalogs/pages/17/1-thumb.webp'));
const detail=read('src/components/materials/ProductDetailClient.tsx');
check('product entry follows English description rather than preceding specifications',()=>assert(detail.indexOf('<CatalogEntry')>detail.indexOf('About This Material')));
const supplier=read('src/components/materials/SupplierDetailClient.tsx');
check('compact supplier header is limited to exact authorized company',()=>{assert.match(supplier,/supplier\?\.id === 242 && slug === 'supplier-1127'/);assert.match(supplier,/compactCatalog \? <CatalogEntry catalogs=\{catalogs\} \/> : <CatalogReader catalogs=\{catalogs\} \/>/);});
console.log(`${count}/${count} PASS`);
