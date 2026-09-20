export type AutoLoadRequestToken = Readonly<{
  generation: number;
  requestId: number;
}>;

export type AutoLoadRequestGuard = ReturnType<typeof createAutoLoadRequestGuard>;

export function createAutoLoadRequestGuard() {
  let generation = 0;
  let nextRequestId = 0;
  let activeToken: AutoLoadRequestToken | null = null;

  return {
    reset() {
      generation += 1;
      activeToken = null;
    },
    acquire(): AutoLoadRequestToken | null {
      if (activeToken) return null;
      activeToken = { generation, requestId: ++nextRequestId };
      return activeToken;
    },
    isCurrent(token: AutoLoadRequestToken) {
      return token.generation === generation;
    },
    release(token: AutoLoadRequestToken) {
      if (activeToken !== token) return false;
      activeToken = null;
      return true;
    },
  };
}

export type AutoLoadRequestResult<T> =
  | { status: 'busy' }
  | { status: 'stale'; lockReleased: boolean }
  | { status: 'success'; value: T; lockReleased: boolean }
  | { status: 'error'; error: unknown; lockReleased: boolean };

export async function requestAutoLoadPage<T>({
  guard,
  load,
  onStart,
}: {
  guard: AutoLoadRequestGuard;
  load: () => Promise<T>;
  onStart?: () => void;
}): Promise<AutoLoadRequestResult<T>> {
  const token = guard.acquire();
  if (!token) return { status: 'busy' };
  onStart?.();

  let status: 'success' | 'error' | 'stale';
  let value: T | undefined;
  let error: unknown;
  try {
    value = await load();
    status = guard.isCurrent(token) ? 'success' : 'stale';
  } catch (caught) {
    error = caught;
    status = guard.isCurrent(token) ? 'error' : 'stale';
  }

  const lockReleased = guard.release(token);
  if (status === 'success') return { status, value: value as T, lockReleased };
  if (status === 'error') return { status, error, lockReleased };
  return { status, lockReleased };
}

export function mergeAutoLoadPage<T extends { id: number }>(
  current: T[],
  incoming: T[],
) {
  const loadedIds = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !loadedIds.has(item.id))];
}

export function hasAnotherAutoLoadPage(itemCount: number, page: number, totalPages: number) {
  return itemCount > 0 && page < totalPages;
}

type AutoLoadObserver = Pick<IntersectionObserver, 'disconnect' | 'observe'>;
type AutoLoadObserverConstructor = new (
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit,
) => AutoLoadObserver;

export function observeAutoLoad(
  target: Element,
  onIntersect: () => void,
  Observer: AutoLoadObserverConstructor = IntersectionObserver,
) {
  const observer = new Observer(
    ([entry]) => {
      if (entry?.isIntersecting) onIntersect();
    },
    { threshold: 0.01, rootMargin: '0px 0px 900px 0px' },
  );
  observer.observe(target);
  return () => observer.disconnect();
}
