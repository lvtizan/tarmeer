#!/usr/bin/env node
// Exercise the actual component's lifecycle, including events missed before hydration.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const jsx = (type, props, key) => ({ type, props: props || {}, key });
const flatten = node => !node || typeof node !== 'object' ? [] :
  [node, ...[node.props.children].flat(Infinity).flatMap(flatten)];
let active;
const sameDeps = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const react = {
  useState(initial) {
    const instance = active;
    const index = instance.cursor++;
    if (!(index in instance.hooks)) instance.hooks[index] = initial;
    return [instance.hooks[index], value => {
      const next = typeof value === 'function' ? value(instance.hooks[index]) : value;
      if (!Object.is(next, instance.hooks[index])) { instance.hooks[index] = next; instance.dirty = true; }
    }];
  },
  useRef(initial) {
    const index = active.cursor++;
    return active.hooks[index] ||= { current: initial };
  },
  useCallback(callback, deps) {
    const index = active.cursor++;
    if (!sameDeps(active.hooks[index]?.deps, deps)) active.hooks[index] = { value: callback, deps };
    return active.hooks[index].value;
  },
  useEffect(effect, deps) {
    const index = active.cursor++;
    if (!sameDeps(active.hooks[index], deps)) active.effects.push(effect);
    active.hooks[index] = deps;
  },
};
function load(relative, dependencies = {}) {
  const exports = {};
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require(name) {
    if (name in dependencies) return dependencies[name];
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'lucide-react') return { ImageOff: 'image-off', RotateCw: 'rotate' };
    throw Error(`Unexpected dependency: ${name}`);
  } });
  return exports;
}
const imageUrl = load('../../src/lib/imageUrl.ts');
const MaterialImage = load('../../src/components/materials/MaterialImage.tsx', {
  '@/lib/imageUrl': imageUrl,
}).default;
function mount(src, cached = {}) {
  let instance, key, tree;
  const props = { src, alt: 'Stone sample' };
  function render() {
    const child = MaterialImage(props);
    if (!instance || key !== child.key) {
      key = child.key;
      instance = { hooks: [] };
    }
    for (let pass = 0; pass < 10; pass++) {
      active = instance;
      Object.assign(instance, { cursor: 0, effects: [], dirty: false });
      tree = child.type(child.props);
      const img = flatten(tree).find(node => node.type === 'img');
      // Commit the current DOM image before passive effects run, as React does.
      for (const hook of instance.hooks) {
        if (hook && typeof hook === 'object' && 'current' in hook) {
          hook.current = img ? (cached[img.props.src] || { complete: false, naturalWidth: 0 }) : null;
        }
      }
      instance.effects.forEach(effect => effect());
      if (!instance.dirty) return;
    }
    throw Error('Component failed to settle');
  }
  render();
  return {
    render,
    update(next) { Object.assign(props, next); render(); },
    nodes: () => flatten(tree),
    image: () => flatten(tree).find(node => node.type === 'img'),
    loading: () => flatten(tree).some(node => node.props.role === 'status'),
    retry: () => flatten(tree).find(node => node.type === 'button'),
  };
}
const original = '/api/uploads/stone.jpg';
const medium = '/api/uploads/stone-medium.webp';
const success = { complete: true, naturalWidth: 1200 };
const failure = { complete: true, naturalWidth: 0 };
const visible = view => { assert.equal(view.loading(), false); assert.doesNotMatch(view.image().props.className, /opacity-0/); };
let count = 0;
function check(name, fn) { fn(); count++; console.log(`PASS ${name}`); }

check('pending image retains loading until the load event', () => {
  const view = mount(original);
  assert(view.loading());
  view.image().props.onLoad(); view.render(); visible(view);
});
check('cached success clears loading without a load event (hydration regression)', () => {
  visible(mount(original, { [medium]: success }));
});
check('cached variant error falls back to an already cached original', () => {
  const view = mount(original, { [medium]: failure, [original]: success });
  visible(view); assert.equal(view.image().props.src, original);
});
check('cached failures show error and retry instead of perpetual loading', () => {
  const view = mount(original, { [medium]: failure, [original]: failure });
  assert.equal(view.loading(), false); assert.equal(view.image(), undefined); assert(view.retry());
});
check('variant error event tries original and keeps loading until original succeeds', () => {
  const view = mount(original);
  view.image().props.onError(); view.render();
  assert.equal(view.image().props.src, original); assert(view.loading());
  view.image().props.onLoad(); view.render(); visible(view);
});
check('original error event ends loading with explicit failure', () => {
  const view = mount(original);
  view.image().props.onError(); view.render(); view.image().props.onError(); view.render();
  assert.equal(view.loading(), false); assert(view.retry());
});
check('retry stops parent navigation, remounts original and rechecks its cache', () => {
  const cached = { [medium]: failure, [original]: failure };
  const view = mount(original, cached);
  let prevented = 0;
  cached[original] = success;
  view.retry().props.onClick({ preventDefault() { prevented++; }, stopPropagation() { prevented++; } });
  view.render(); visible(view); assert.equal(prevented, 2); assert.equal(view.image().props.src, original);
});
check('retry can fail again without an effect loop', () => {
  const view = mount(original, { [medium]: failure, [original]: failure });
  view.retry().props.onClick({ preventDefault() {}, stopPropagation() {} }); view.render();
  assert(view.retry()); assert.equal(view.loading(), false);
});
check('changing a loaded source starts loading the new variant', () => {
  const view = mount(original, { [medium]: success });
  view.update({ src: '/uploads/new.jpg' });
  assert(view.loading()); assert.equal(view.image().props.src, '/api/uploads/new-medium.webp');
});
check('changing a failed source clears failure and fallback', () => {
  const view = mount(original, { [medium]: failure, [original]: failure });
  view.update({ src: '/uploads/new.jpg' });
  assert(view.loading()); assert.equal(view.retry(), undefined); assert.equal(view.image().props.src, '/api/uploads/new-medium.webp');
});
check('missing and whitespace sources show pending without loading or a request', () => {
  for (const src of [null, undefined, '', '   ']) {
    const view = mount(src);
    assert.equal(view.loading(), false); assert.equal(view.image(), undefined); assert.equal(view.retry(), undefined);
  }
});
check('external URLs without variants fail explicitly', () => {
  const url = 'https://example.com/stone.jpg';
  const view = mount(url, { [url]: failure });
  assert(view.retry()); assert.equal(view.loading(), false);
});
check('data URLs already loaded are visible immediately after mount', () => {
  const url = 'data:image/png;base64,abc';
  visible(mount(url, { [url]: success }));
});
check('alt changes preserve successful loading; eager settings remain supported', () => {
  const view = mount(original, { [medium]: success });
  view.update({ alt: 'New label', eager: true });
  visible(view); assert.equal(view.image().props.alt, 'New label');
  assert.equal(view.image().props.loading, 'eager'); assert.equal(view.image().props.fetchPriority, 'high');
});
console.log(`material-image-loading: ${count}/${count} PASS`);
