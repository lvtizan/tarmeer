/**
 * 后台列表时间统一格式：YYYY/MM/DD HH:mm
 * 例：2026/05/04 15:23
 *
 * 字号统一为 15px（在 className 用 text-[15px] 或行内 fontSize:15）。
 */
export function formatAdminDateTime(input: string | Date | null | undefined): string {
  if (!input) return '—';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (!(d instanceof Date) || isNaN(d.getTime())) return '—';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
}

/** 统一字号 className：在表格/列表里用作时间字段的 class */
export const ADMIN_TIME_CLS = 'text-[15px] tabular-nums text-stone-500';
