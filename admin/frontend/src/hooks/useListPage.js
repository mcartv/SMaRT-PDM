import { useCallback, useMemo, useRef, useState } from 'react';

// A changed filter key immediately requests page one, including before effects run.
export function useListPage(filters, limit = 10) {
  const key = JSON.stringify(filters);
  const [position, setPosition] = useState({ key, page: 1 });
  if (position.key !== key) setPosition({ key, page: 1 });
  const page = position.key === key ? position.page : 1;
  const setPage = useCallback((next) => setPosition((current) => {
    const previous = current.key === key ? current.page : 1;
    return { key, page: typeof next === 'function' ? next(previous) : next };
  }), [key]);
  const query = useMemo(() => new URLSearchParams({ ...JSON.parse(key), page, limit }).toString(), [key, page, limit]);
  const [metadata, setMetadata] = useState({ pagination: { total: 0, totalPages: 1 }, filters: {}, summary: {} });
  const currentQuery = useRef(query);
  currentQuery.current = query;
  const sequence = useRef(0);
  const isQueryCurrent = useCallback(() => currentQuery.current === query, [query]);
  const beginRequest = useCallback(() => {
    if (currentQuery.current !== query) return () => false;
    const id = ++sequence.current;
    return () => id === sequence.current && currentQuery.current === query;
  }, [query]);
  const accept = useCallback((payload) => {
    setMetadata(payload);
    if (payload.pagination?.page && payload.pagination.page !== page) setPage(payload.pagination.page);
  }, [page, setPage]);
  return { page, setPage, query, metadata, accept, beginRequest, isQueryCurrent };
}
