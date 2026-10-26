import { pageList } from "./page-list";

/** Library pagination: first / previous, page numbers, next / last and the shown range. */
export default function Pagination({ page, total, pageSize, setPage }: {
  page: number;
  total: number;
  pageSize: number;
  setPage: (page: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 pt-2">
      <button
        onClick={() => setPage(1)}
        disabled={page === 1}
        className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
      >
        «
      </button>
      <button
        onClick={() => setPage(Math.max(1, page - 1))}
        disabled={page === 1}
        className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
      >
        ‹
      </button>
      {pageList(page, totalPages).map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-2 text-xs text-gray-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                page === p
                  ? "bg-purple-600 text-white border-purple-600"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {p}
            </button>
          )
        )}
      <button
        onClick={() => setPage(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
      >
        ›
      </button>
      <button
        onClick={() => setPage(totalPages)}
        disabled={page === totalPages}
        className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
      >
        »
      </button>
      <span className="text-xs text-gray-400 ml-2">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} z {total}
      </span>
    </div>
  );
}
