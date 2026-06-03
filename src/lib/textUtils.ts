/**
 * Truncate a string to `max` characters, appending an ellipsis when trimmed.
 */
export function truncateText(str: string | null | undefined, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '…' : str;
}
