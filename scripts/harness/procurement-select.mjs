import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let count = 0;
const check = (name, fn) => { fn(); count++; console.log(`PASS ${name}`); };
const jsx = (type, props) => ({type, props: props || {}});
const flatten = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(flatten)];
let opened = false;
let refs = [];
let effects = [];
let active = null;
const document = { get activeElement() { return active; }, addEventListener() {}, removeEventListener() {} };
function load(file, overrides = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../../src/components/materials/${file}`, import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}}).outputText, {
    exports, document, require(name) {
      if (name in overrides) return overrides[name];
      if (name === 'react') return {useId: () => 'test', useRef: () => { const ref = {current: null}; refs.push(ref); return ref; }, useState: () => [opened, value => { opened = typeof value === 'function' ? value(opened) : value; }], useEffect: effect => effects.push(effect)};
      if (name === 'react/jsx-runtime') return {jsx, jsxs: jsx};
      if (name === 'lucide-react') return {Check: 'check', ChevronDown: 'chevron'};
      throw Error(name);
    }
  });
  return exports.default;
}
const Select = load('ProcurementSelect.tsx');
const options = [{value:'',label:'Any'},{value:'AED',label:'AED'},{value:'blocked',label:'Disabled',disabled:true},{value:'USD',label:'USD'}];
let changed;
function render(value = '') {
  refs = []; effects = [];
  const tree = Select({label: 'Price currency',value,options,onChange: value => changed = value});
  const nodes = flatten(tree);
  const trigger = nodes.find(node => node.props['aria-haspopup']);
  refs[1].current = {focus() {active = 'trigger';}};
  const buttons = options.filter(option => !option.disabled).map(option => ({dataset:{value:option.value},focus(){active = this;}}));
  refs[2].current = {querySelectorAll: () => buttons};
  return {tree,nodes,trigger,buttons,list:nodes.find(node => node.props.role === 'listbox')};
}
let view = render();
check('closed trigger has label and no native select', () => {assert.equal(view.trigger.props['aria-labelledby'],'test-label test-value');assert(!view.nodes.some(node => node.type === 'select'));});
check('white trigger and 16px arrow gutter', () => {assert.match(view.trigger.props.className,/bg-white/);assert.match(view.trigger.props.className,/pr-4/);});
view.trigger.props.onClick(); view = render('AED'); effects.forEach(effect => effect());
check('opening focuses selected enabled option', () => assert.equal(active.dataset.value,'AED'));
check('menu white and disabled option preserved', () => {assert.match(view.list.props.className,/bg-white/);assert(view.nodes.find(node => node.props['data-value'] === 'blocked').props.disabled);});
const key = key => view.list.props.onKeyDown({key,preventDefault(){}});
check('arrow skips disabled option', () => {key('ArrowDown');assert.equal(active.dataset.value,'USD');});
check('Home and End keyboard navigation', () => {key('Home');assert.equal(active.dataset.value,'');key('End');assert.equal(active.dataset.value,'USD');});
check('selection updates value, closes, restores focus', () => {view.nodes.find(node => node.props['data-value'] === 'USD').props.onClick();assert.equal(changed,'USD');assert.equal(opened,false);assert.equal(active,'trigger');});
opened=true;view=render();
check('Escape closes and restores focus', () => {view.tree.props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){}});assert.equal(opened,false);assert.equal(active,'trigger');});
const Filters = load('ProcurementFilters.tsx', {'./ProcurementSelect':{default:Select},'@/lib/supplierProductUnits':{PRODUCT_UNITS:[{value:'SQM',en:'㎡'}]}});
let changes;
const filterNodes = filters => flatten(Filters({filters,onChange:value=>changes=value,onClear(){}})).filter(node=>node.type===Select);
check('all five filters use styled dropdown', () => assert.equal(filterNodes({}).length,5));
check('currency reset keeps original sort rule', () => {filterNodes({}).find(node=>node.props.label==='Price currency').props.onChange('USD');assert.equal(changes.currency,'USD');assert.equal(changes.sort,'');});
check('price sort disabled until currency and unit chosen', () => {assert(filterNodes({currency:'USD'}).find(node=>node.props.label==='Sort').props.options[2].disabled);assert.equal(filterNodes({currency:'USD',unit:'SQM'}).find(node=>node.props.label==='Sort').props.options[2].disabled,false);});
console.log(`${count}/${count} PASS`);
