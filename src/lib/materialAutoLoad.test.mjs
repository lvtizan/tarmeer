import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAutoLoadRequestGuard,
  hasAnotherAutoLoadPage,
  mergeAutoLoadPage,
  observeAutoLoad,
  requestAutoLoadPage,
} from './materialAutoLoad.ts';

test('observer starts loading near the sentinel and disconnects on cleanup', () => {
  let instance;
  class FakeObserver {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      this.disconnected = false;
      instance = this;
    }
    observe(target) {
      this.target = target;
    }
    disconnect() {
      this.disconnected = true;
    }
    trigger(isIntersecting) {
      this.callback([{ isIntersecting }]);
    }
  }

  const sentinel = {};
  let loads = 0;
  const cleanup = observeAutoLoad(sentinel, () => { loads += 1; }, FakeObserver);

  assert.equal(instance.target, sentinel);
  assert.equal(instance.options.rootMargin, '0px 0px 900px 0px');
  instance.trigger(false);
  assert.equal(loads, 0);
  instance.trigger(true);
  assert.equal(loads, 1);
  cleanup();
  assert.equal(instance.disconnected, true);
});

test('one generation permits one active page request and permits retry after failure', async () => {
  const guard = createAutoLoadRequestGuard();
  let releaseFetch;
  const pending = requestAutoLoadPage({
    guard,
    load: () => new Promise((resolve) => { releaseFetch = resolve; }),
  });
  assert.deepEqual(
    await requestAutoLoadPage({ guard, load: async () => 'duplicate' }),
    { status: 'busy' },
  );
  releaseFetch('page 2');
  assert.deepEqual(await pending, { status: 'success', value: 'page 2', lockReleased: true });

  const failed = await requestAutoLoadPage({ guard, load: async () => { throw new Error('network'); } });
  assert.equal(failed.status, 'error');
  const retry = await requestAutoLoadPage({ guard, load: async () => 'retried' });
  assert.equal(retry.status, 'success');
});

test('a stale country or category request cannot update or unlock the new request', async () => {
  const guard = createAutoLoadRequestGuard();
  let releaseStaleFetch;
  const stale = requestAutoLoadPage({
    guard,
    load: () => new Promise((resolve) => { releaseStaleFetch = resolve; }),
  });

  guard.reset();
  let releaseCurrentFetch;
  const current = requestAutoLoadPage({
    guard,
    load: () => new Promise((resolve) => { releaseCurrentFetch = resolve; }),
  });
  releaseStaleFetch('wrong country');
  assert.deepEqual(await stale, { status: 'stale', lockReleased: false });
  assert.deepEqual(
    await requestAutoLoadPage({ guard, load: async () => 'duplicate' }),
    { status: 'busy' },
  );
  releaseCurrentFetch('right country');
  assert.deepEqual(await current, { status: 'success', value: 'right country', lockReleased: true });
});

test('continuous pages append new products once and preserve their order', () => {
  const firstPage = [{ id: 1 }, { id: 2 }];
  const secondPage = [{ id: 2 }, { id: 3 }, { id: 4 }];
  assert.deepEqual(
    mergeAutoLoadPage(firstPage, secondPage).map(({ id }) => id),
    [1, 2, 3, 4],
  );
});

test('an empty or final API page stops in the component pagination contract', () => {
  assert.equal(hasAnotherAutoLoadPage(0, 2, 5), false);
  assert.equal(hasAnotherAutoLoadPage(1, 5, 5), false);
  assert.equal(hasAnotherAutoLoadPage(1, 2, 5), true);
});
