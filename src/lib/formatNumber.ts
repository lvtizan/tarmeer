export function toNumber(value: unknown): number {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

export function formatCount(value: unknown): string {
  return new Intl.NumberFormat('en-US').format(toNumber(value));
}
