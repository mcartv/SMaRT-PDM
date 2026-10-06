// SQL fragments passed here are owned by services; all user values are bound.
function paginationRequested(query = {}) {
  return query.page !== undefined || query.limit !== undefined;
}

function parsePagination(query = {}, defaultLimit = 10) {
  const parse = (value, fallback, max) => {
    if (value === undefined || value === '') return fallback;
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 1) {
      const error = new Error('page and limit must be positive integers');
      error.statusCode = 400;
      throw error;
    }
    return Math.min(number, max);
  };
  return { page: parse(query.page, 1, 1000000), limit: parse(query.limit, defaultLimit, 100) };
}

function buildPagination(page, limit, total) {
  total = Number(total) || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  page = Math.min(page, totalPages);
  return { page, limit, total, totalPages, hasPrevious: page > 1, hasNext: page < totalPages };
}

function listFilters(query, fields, searchFields = [], initialParams = []) {
  const params = [...initialParams];
  const conditions = [];
  const bind = (value) => { params.push(value); return `$${params.length}`; };
  for (const [key, expression] of Object.entries(fields)) {
    if (key === 'studentNumber') continue;
    const value = String(query[key] ?? '').trim();
    if (!value || /^(all|all .*)$/i.test(value)) continue;
    conditions.push(`(${expression})::text = ${bind(value)}`);
  }
  const search = String(query.search || '').trim().toLowerCase();
  if (search && searchFields.length) {
    const placeholder = bind(search);
    const matches = searchFields.map((field) => `strpos(lower(coalesce((${field})::text, '')), ${placeholder}) > 0`);
    if (fields.studentNumber) {
      const normalized = search.replace(/[^a-z0-9]/g, '');
      if (normalized) matches.push(`strpos(regexp_replace(lower(coalesce((${fields.studentNumber})::text, '')), '[^a-z0-9]', '', 'g'), ${bind(normalized)}) > 0`);
    }
    conditions.push(`(${matches.join(' OR ')})`);
  }
  return { params, where: conditions.length ? conditions.join(' AND ') : 'true' };
}

async function queryPage(db, { source, query = {}, params = [], where = 'true', order, facets = {}, summary = {}, defaultLimit = 10 }) {
  const requested = parsePagination(query, defaultLimit);
  const facetSql = Object.entries(facets).map(([key, expression]) =>
    `coalesce(array_agg(DISTINCT (${expression})::text ORDER BY (${expression})::text) FILTER (WHERE (${expression}) IS NOT NULL AND (${expression})::text <> ''), ARRAY[]::text[]) AS "${key}"`);
  const summarySql = Object.entries(summary).map(([key, expression]) => `${expression} AS "${key}"`);
  // Facets and summary cover the authorized source, while total covers filters.
  const metadata = await db.query(`WITH source AS (${source}) SELECT count(*) FILTER (WHERE ${where}) AS filtered_total${[...facetSql, ...summarySql].map((sql) => ', ' + sql).join('')} FROM source`, params);
  const meta = metadata.rows[0] || {};
  const pagination = buildPagination(requested.page, requested.limit, meta.filtered_total);
  const rows = await db.query(`SELECT * FROM (${source}) AS source WHERE ${where} ORDER BY ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pagination.limit, (pagination.page - 1) * pagination.limit]);
  return {
    items: rows.rows,
    pagination,
    filters: Object.fromEntries(Object.keys(facets).map((key) => [key, meta[key] || []])),
    summary: Object.fromEntries(Object.keys(summary).map((key) => [key, Number(meta[key]) || 0])),
  };
}

module.exports = { paginationRequested, parsePagination, buildPagination, listFilters, queryPage };
