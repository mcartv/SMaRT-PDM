import { Button } from './ui/button';

export default function ServerPagination({ page, setPage, pagination, label = 'records' }) {
  const { total = 0, totalPages = 1, limit = 10 } = pagination || {};
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 py-3 text-xs text-stone-500">
      <span>Showing {total ? (page - 1) * limit + 1 : 0}–{Math.min(page * limit, total)} of {total} {label}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
        <span>Page {page} of {totalPages}</span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
      </div>
    </nav>
  );
}
