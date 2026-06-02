'use client';

interface AdminPaginationProps {
  page: number;
  totalPages: number;
  total?: number;
  onPageChange: (page: number) => void;
  /** Label pair [prev, next].  Defaults to ['Prev', 'Next']. */
  labels?: [string, string];
  /** Optional format callback for the page info text. */
  formatInfo?: (page: number, totalPages: number, total?: number) => string;
}

export default function AdminPagination({
  page,
  totalPages,
  total,
  onPageChange,
  labels = ['Prev', 'Next'],
  formatInfo,
}: AdminPaginationProps) {
  if (totalPages <= 1) return null;

  const info = formatInfo
    ? formatInfo(page, totalPages, total)
    : total != null
      ? `Page ${page} of ${totalPages} (${total} total)`
      : `Page ${page} of ${totalPages}`;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100">
      <span className="text-xs text-stone-500">{info}</span>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30"
        >
          {labels[0]}
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30"
        >
          {labels[1]}
        </button>
      </div>
    </div>
  );
}
