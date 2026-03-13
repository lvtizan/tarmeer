export function parseJsonField<T = any>(value: T | string | null | undefined) {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (typeof value === 'object') {
    return value;
  }

  return null;
}
