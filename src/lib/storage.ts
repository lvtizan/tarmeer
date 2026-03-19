/**
 * Safe localStorage operations with error handling
 * Prevents crashes in Safari private mode and other storage-restricted environments
 */

/**
 * Safely set an item in localStorage
 * @returns true if successful, false otherwise
 */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'QuotaExceededError') {
        console.error(`Storage quota exceeded for key: ${key}`);
      } else {
        console.error(`Failed to save to localStorage: ${error.message}`);
      }
    }
    return false;
  }
}

/**
 * Safely get an item from localStorage
 * @returns The value or null if not found/error
 */
export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error(`Failed to read from localStorage: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

/**
 * Safely remove an item from localStorage
 * @returns true if successful, false otherwise
 */
export function safeRemoveItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Failed to remove from localStorage: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

/**
 * Safely parse JSON from localStorage
 * @returns The parsed value or null if not found/error
 */
export function safeGetJSON<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    return JSON.parse(item) as T;
  } catch (error) {
    console.error(`Failed to parse JSON from localStorage: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

/**
 * Safely stringify and save JSON to localStorage
 * @returns true if successful, false otherwise
 */
export function safeSetJSON<T>(key: string, value: T): boolean {
  try {
    const serialized = JSON.stringify(value);
    return safeSetItem(key, serialized);
  } catch (error) {
    console.error(`Failed to stringify JSON for localStorage: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

/**
 * Check if localStorage is available
 */
export function isStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}
