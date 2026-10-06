const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

function loadListService(name, { total = 25, items = [], summary = {}, tableRows = {}, extraRows = [] } = {}) {
  const calls = [];
  const reads = [];
  const file = path.resolve(__dirname, '../services', name + '.js');
  const actualRequire = createRequire(file);
  const db = { async query(sql, params = []) {
    calls.push({ sql, params });
    if (/AS filtered_total/.test(sql)) return { rows: [{ filtered_total: total, ...summary }] };
    if (/LIMIT \$\d+ OFFSET \$\d+/.test(sql)) return { rows: items };
    return { rows: extraRows };
  } };
  const supabase = { from(table) {
    const read = { table, filters: [] };
    reads.push(read);
    const builder = new Proxy({}, { get(_, key) {
      if (key === 'then') return (resolve) => Promise.resolve({ data: tableRows[table] || [], error: null }).then(resolve);
      if (key === 'maybeSingle') return () => Promise.resolve({ data: tableRows[table]?.[0] || { admin_id: 'admin' }, error: null });
      return (...args) => { read.filters.push([key, ...args]); return builder; };
    } });
    return builder;
  }, storage: { from() { throw new Error('Unexpected signing of off-page storage'); } } };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    module, exports: module.exports, console, process, Buffer, __dirname: path.dirname(file),
    require(dependency) {
      if (dependency === '../config/db') return db;
      if (dependency === '../config/supabase') return supabase;
      if (dependency === './readinessQueueService') return { syncOpeningFcfsQueue: async () => {} };
      if (dependency === './notificationService' || dependency === '../config/appCache') return {};
      return actualRequire(dependency);
    },
  }, { filename: file });
  return { service: module.exports, calls, reads };
}

module.exports = { loadListService };
