export function getImportPreviewPage(rows, { search = '', offense = 'all', status = 'all', page = 0, pageSize = 20 } = {}) {
  const query = search.trim().toLowerCase();
  const filtered = rows.filter(row => {
    const text = [row.student_number, row.first_name, row.middle_name, row.last_name, row.course_code, row.year_level].filter(Boolean).join(' ').toLowerCase();
    return (!query || text.includes(query)) && (offense === 'all' || row.offense_type === offense) && (status === 'all' || row.status === status);
  });
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.max(0, Math.min(page, totalPages - 1));
  return { rows: filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize), total, totalPages, page: currentPage };
}
