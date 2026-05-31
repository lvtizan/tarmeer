const isServer = typeof window === 'undefined';

export function safeSetItem(key: string, value: string): boolean {
  if (isServer) return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.error(`Storage quota exceeded for key: ${key}`);
    }
    return false;
  }
}

export function safeGetItem(key: string): string | null {
  if (isServer) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeRemoveItem(key: string): boolean {
  if (isServer) return false;
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function safeGetJSON<T>(key: string): T | null {
  if (isServer) return null;
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    return JSON.parse(item) as T;
  } catch {
    return null;
  }
}

export function safeSetJSON<T>(key: string, value: T): boolean {
  try {
    const serialized = JSON.stringify(value);
    return safeSetItem(key, serialized);
  } catch {
    return false;
  }
}

export function isStorageAvailable(): boolean {
  if (isServer) return false;
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}
