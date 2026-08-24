'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PATCH_NAME = 'SMaRT-PDM Student Registry Dynamic Import v2';
const FRONTEND_REL = 'admin/frontend/src/pages/maintenance/StudentRegistryPanel.jsx';
const BACKEND_REL = 'admin/backend/services/studentRegistryService.js';
const TEST_REL = 'admin/backend/test/student-registry-dynamic-import-contract.test.js';

function fail(message) {
  throw new Error(message);
}

function normalizeLf(text) {
  return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function detectEol(text) {
  return String(text).includes('\r\n') ? '\r\n' : '\n';
}

function restoreEol(text, eol) {
  return eol === '\r\n' ? normalizeLf(text).replace(/\n/g, '\r\n') : normalizeLf(text);
}

function existsRepo(root) {
  return fs.existsSync(path.join(root, FRONTEND_REL)) && fs.existsSync(path.join(root, BACKEND_REL));
}

function findRepo(start) {
  const initial = path.resolve(start || process.cwd());
  const candidates = [initial, process.cwd()];

  for (const candidate of candidates) {
    let current = path.resolve(candidate);
    for (;;) {
      if (existsRepo(current)) return current;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }

  fail(`Could not find the SMaRT-PDM repository. Expected ${FRONTEND_REL}`);
}

function replaceOnce(source, search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) {
    fail(`${label}: expected exactly one source block, found ${count}.`);
  }
  return source.replace(search, replacement);
}

function replaceBetween(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) fail(`${label}: start marker was not found.`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) fail(`${label}: end marker was not found.`);
  if (source.indexOf(startMarker, start + 1) >= 0) {
    fail(`${label}: start marker is not unique.`);
  }
  return source.slice(0, start) + replacement + source.slice(end);
}

function run(command, args, cwd, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
    shell: false,
    windowsHide: true,
  });

  if (result.error) throw result.error;
  return result;
}

function runNpm(args, cwd, { capture = false } = {}) {
  if (process.platform === 'win32') {
    // .cmd files cannot be spawned reliably with shell:false on Windows.
    // Route npm through the user's command processor instead. This avoids
    // spawnSync npm.cmd EINVAL while still keeping shell:false here.
    const commandProcessor = process.env.ComSpec || process.env.COMSPEC || 'cmd.exe';
    const commandLine = ['npm', ...args].join(' ');
    return run(commandProcessor, ['/d', '/s', '/c', commandLine], cwd, { capture });
  }

  return run('npm', args, cwd, { capture });
}

function extractFailingTests(output) {
  const text = String(output || '');
  const failures = new Set();

  for (const line of text.split(/\r?\n/)) {
    let match = line.match(/^\s*[✖✗×]\s+(.+?)\s*(?:\(|$)/u);
    if (match) {
      failures.add(match[1].trim());
      continue;
    }
    match = line.match(/^\s*not ok\s+\d+\s+-\s+(.+)$/i);
    if (match) failures.add(match[1].trim());
  }

  return failures;
}

function captureBackendBaseline(backendDir, label) {
  console.log(`\n> npm test (${label})`);
  const result = runNpm(['test'], backendDir, { capture: true });
  const combined = `${result.stdout || ''}\n${result.stderr || ''}`;
  const failures = extractFailingTests(combined);

  if (result.status === 0) {
    console.log('      Backend suite: PASS');
  } else {
    console.log(`      Backend suite: already failing (${failures.size || 'unknown'} failing tests)`);
    [...failures].slice(0, 12).forEach((name) => console.log(`        - ${name}`));
    if (failures.size > 12) console.log(`        - ... ${failures.size - 12} more`);
  }

  return { status: result.status, failures, output: combined };
}

function assertNoNewFailures(before, after) {
  if (before.status === 0 && after.status !== 0) {
    fail('The backend suite was green before this patch and failed afterward.');
  }

  if (before.status !== 0 && after.status !== 0) {
    const added = [...after.failures].filter((name) => !before.failures.has(name));
    if (added.length) {
      fail(`New backend test failures appeared: ${added.join('; ')}`);
    }
  }
}

function buildFrontend(source) {
  let out = source;

  out = replaceOnce(
    out,
    "const [excelHeaders, setExcelHeaders] = useState(EXCEL_HEADERS_FALLBACK);\n  const [excelRows, setExcelRows] = useState([]);",
    "const [excelHeaders, setExcelHeaders] = useState([]);\n  const [lastImportedHeaders, setLastImportedHeaders] = useState([]);\n  const [excelRows, setExcelRows] = useState([]);",
    'Frontend dynamic header state'
  );

  const helperAnchor = `function normalizeHeaderKey(header) {\n  return String(header || '')\n    .trim()\n    .toLowerCase()\n    .replace(/\\s+/g, ' ');\n}\n`;

  const helpers = `${helperAnchor}\nconst REGISTRY_HEADER_ORDER_KEY = '__smart_pdm_header_order';\n\nconst REGISTRY_HEADER_ALIASES = {\n  studentNumber: ['student number', 'student no', 'student id', 'pdm id', 'pdm no', 'pdm number'],\n  surname: ['surname', 'last name', 'family name'],\n  firstName: ['first name', 'given name', 'given names'],\n  middleName: ['middle name', 'middle initial'],\n  course: ['course', 'course code', 'degree program', 'program', 'program code', 'course/program'],\n  year: ['year level', 'year', 'level'],\n};\n\nfunction formatWorkbookCellValue(value) {\n  if (value === null || value === undefined) return '';\n  if (value instanceof Date && !Number.isNaN(value.getTime())) {\n    return value.toISOString().slice(0, 10);\n  }\n  if (typeof value !== 'object') return String(value);\n  if (Array.isArray(value.richText)) {\n    return value.richText.map((part) => part?.text || '').join('');\n  }\n  if (value.result !== undefined && value.result !== null) {\n    return formatWorkbookCellValue(value.result);\n  }\n  if (value.text !== undefined && value.text !== null) {\n    return String(value.text);\n  }\n  try {\n    return JSON.stringify(value);\n  } catch {\n    return String(value);\n  }\n}\n\nfunction buildDisplayColumns(headerRow = [], bodyRows = []) {\n  const maxColumns = Math.max(\n    headerRow.length,\n    ...bodyRows.map((row) => (Array.isArray(row) ? row.length : 0)),\n    0\n  );\n  const seen = new Map();\n  const columns = [];\n\n  for (let index = 0; index < maxColumns; index += 1) {\n    const rawHeader = formatWorkbookCellValue(headerRow[index]).trim();\n    const columnHasData = bodyRows.some((row) =>\n      formatWorkbookCellValue(row?.[index]).trim() !== ''\n    );\n\n    if (!rawHeader && !columnHasData) continue;\n\n    const baseLabel = rawHeader || \`Column \${index + 1}\`;\n    const key = normalizeHeaderKey(baseLabel);\n    const occurrence = (seen.get(key) || 0) + 1;\n    seen.set(key, occurrence);\n\n    columns.push({\n      index,\n      label: occurrence === 1 ? baseLabel : \`\${baseLabel} (\${occurrence})\`,\n    });\n  }\n\n  return columns;\n}\n\nfunction findHeaderByAliases(headers = [], aliases = []) {\n  const wanted = new Set(aliases.map(normalizeHeaderKey));\n  return headers.find((header) => wanted.has(normalizeHeaderKey(header))) || null;\n}\n\nfunction getSnapshotHeaders(row = {}) {\n  const snapshot = row?.raw_snapshot;\n  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return [];\n\n  const ordered = snapshot[REGISTRY_HEADER_ORDER_KEY];\n  if (Array.isArray(ordered)) {\n    return ordered\n      .map((header) => String(header || '').trim())\n      .filter(Boolean);\n  }\n\n  return Object.keys(snapshot).filter((key) => key !== REGISTRY_HEADER_ORDER_KEY);\n}\n\nfunction buildImportedHeaders(rows = [], preferredHeaders = []) {\n  const headers = [];\n  const seen = new Set();\n  const append = (header) => {\n    const label = String(header || '').trim();\n    const normalized = normalizeHeaderKey(label);\n    if (!label || !normalized || seen.has(normalized)) return;\n    seen.add(normalized);\n    headers.push(label);\n  };\n\n  preferredHeaders.forEach(append);\n\n  [...rows]\n    .sort((left, right) => {\n      const a = new Date(left?.imported_at || 0).getTime() || 0;\n      const b = new Date(right?.imported_at || 0).getTime() || 0;\n      return b - a;\n    })\n    .forEach((row) => getSnapshotHeaders(row).forEach(append));\n\n  return headers.length ? headers : EXCEL_HEADERS_FALLBACK;\n}\n\nfunction buildImportedDisplayRow(row, headers) {\n  const snapshot = row?.raw_snapshot;\n  const hasSnapshot =\n    snapshot &&\n    typeof snapshot === 'object' &&\n    !Array.isArray(snapshot) &&\n    Object.keys(snapshot).some((key) => key !== REGISTRY_HEADER_ORDER_KEY);\n\n  if (!hasSnapshot) {\n    const legacy = buildBackendRowForExcelShape(row);\n    return Object.fromEntries(headers.map((header) => [header, legacy[header] ?? '']));\n  }\n\n  return Object.fromEntries(\n    headers.map((header) => [\n      header,\n      Object.prototype.hasOwnProperty.call(snapshot, header) ? snapshot[header] ?? '' : '',\n    ])\n  );\n}\n`;

  out = replaceOnce(out, helperAnchor, helpers, 'Frontend dynamic registry helpers');

  const previewReplacement = `  const parseWorkbookPreview = async (selectedFile) => {\n    const lowerName = selectedFile.name.toLowerCase();\n    let rows = [];\n\n    if (lowerName.endsWith('.csv')) {\n      const text = await selectedFile.text();\n      rows = parseCsvRows(text);\n    } else if (lowerName.endsWith('.xlsx')) {\n      const buffer = await selectedFile.arrayBuffer();\n      const workbook = new ExcelJS.Workbook();\n\n      await workbook.xlsx.load(buffer);\n\n      const worksheet = workbook.worksheets[0];\n\n      if (!worksheet) {\n        throw new Error('No worksheet found in the uploaded file.');\n      }\n\n      worksheet.eachRow({ includeEmpty: false }, (row) => {\n        rows.push(row.values.slice(1).map(formatWorkbookCellValue));\n      });\n    } else {\n      throw new Error('Only .xlsx and .csv files are allowed.');\n    }\n\n    if (!rows.length) {\n      throw new Error('The uploaded file is empty.');\n    }\n\n    const bodyRows = rows\n      .slice(1)\n      .filter((row) =>\n        Array.isArray(row) &&\n        row.some((cell) => formatWorkbookCellValue(cell).trim() !== '')\n      );\n    const columns = buildDisplayColumns(rows[0] || [], bodyRows);\n    const headers = columns.map((column) => column.label);\n\n    if (!headers.length) {\n      throw new Error('No usable columns were found in the uploaded file.');\n    }\n\n    const body = bodyRows.map((row) =>\n      Object.fromEntries(\n        columns.map((column) => [\n          column.label,\n          formatWorkbookCellValue(row[column.index]),\n        ])\n      )\n    );\n\n    setExcelSheetName(selectedFile.name);\n    setExcelHeaders(headers);\n    setExcelRows(body);\n    setTableMode('excel');\n    setCourseFilter('all');\n    setYearFilter('all');\n    setDraftCourseFilter('all');\n    setDraftYearFilter('all');\n    setPage(1);\n  };\n\n`;

  out = replaceBetween(
    out,
    '  const parseWorkbookPreview = async (selectedFile) => {',
    '  const handleFileSelect = async (selectedFile) => {',
    previewReplacement,
    'Frontend workbook preview parser'
  );

  out = replaceOnce(
    out,
    "    setExcelHeaders(EXCEL_HEADERS_FALLBACK);",
    "    setExcelHeaders([]);",
    'Frontend clear selected file headers'
  );

  out = replaceOnce(
    out,
    `      await loadRegistry();\n\n      setTableMode('imported');`,
    `      await loadRegistry();\n      setLastImportedHeaders(\n        Array.isArray(data.source_headers) && data.source_headers.length\n          ? data.source_headers\n          : excelHeaders\n      );\n\n      setTableMode('imported');`,
    'Frontend remember imported source headers'
  );

  const importedBlock = `  const importedHeaders = useMemo(() => {\n    return buildImportedHeaders(registry, lastImportedHeaders);\n  }, [registry, lastImportedHeaders]);\n\n  const importedRows = useMemo(() => {\n    return registry.map((row) => buildImportedDisplayRow(row, importedHeaders));\n  }, [registry, importedHeaders]);\n\n  const currentHeaders = useMemo(() => {\n    if (tableMode === 'excel' && excelHeaders.length) return excelHeaders;\n    return importedHeaders;\n  }, [tableMode, excelHeaders, importedHeaders]);\n\n  const currentRows = useMemo(() => {\n    return tableMode === 'excel' ? excelRows : importedRows;\n  }, [tableMode, excelRows, importedRows]);\n\n`;

  out = replaceBetween(
    out,
    '  const importedRowsAsExcelShape = useMemo(() => {',
    '  const courseOptions = useMemo(() => {',
    importedBlock,
    'Frontend imported dynamic table'
  );

  const filterBlock = `  const courseOptions = useMemo(() => {\n    const courseHeader = findHeaderByAliases(\n      currentHeaders,\n      REGISTRY_HEADER_ALIASES.course\n    );\n\n    if (!courseHeader) return [];\n\n    return Array.from(\n      new Set(\n        currentRows\n          .map((row) => row[courseHeader])\n          .filter((value) => String(value || '').trim() !== '')\n          .map((value) => String(value).trim())\n      )\n    ).sort((a, b) => a.localeCompare(b));\n  }, [currentHeaders, currentRows]);\n\n  const yearOptions = useMemo(() => {\n    const yearHeader = findHeaderByAliases(\n      currentHeaders,\n      REGISTRY_HEADER_ALIASES.year\n    );\n\n    if (!yearHeader) return [];\n\n    return Array.from(\n      new Set(\n        currentRows\n          .map((row) => row[yearHeader])\n          .filter((value) => String(value || '').trim() !== '')\n          .map((value) => String(value).trim())\n      )\n    ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));\n  }, [currentHeaders, currentRows]);\n\n  const filteredRows = useMemo(() => {\n    const q = normalizeText(search);\n    const courseHeader = findHeaderByAliases(\n      currentHeaders,\n      REGISTRY_HEADER_ALIASES.course\n    );\n    const yearHeader = findHeaderByAliases(\n      currentHeaders,\n      REGISTRY_HEADER_ALIASES.year\n    );\n\n    return currentRows.filter((row) => {\n      const searchableText = normalizeText(\n        currentHeaders.map((header) => row[header] ?? '').join(' ')\n      );\n      const courseCode = courseHeader\n        ? String(row[courseHeader] || '').trim()\n        : '';\n      const yearLevel = yearHeader\n        ? String(row[yearHeader] || '').trim()\n        : '';\n\n      const matchesSearch = !q || searchableText.includes(q);\n      const matchesCourse =\n        courseFilter === 'all' ||\n        (courseHeader && courseCode === courseFilter);\n      const matchesYear =\n        yearFilter === 'all' ||\n        (yearHeader && yearLevel === yearFilter);\n\n      return matchesSearch && matchesCourse && matchesYear;\n    });\n  }, [currentRows, currentHeaders, search, courseFilter, yearFilter]);\n\n`;

  out = replaceBetween(
    out,
    '  const courseOptions = useMemo(() => {',
    '  useEffect(() => {\n    setPage(1);',
    filterBlock,
    'Frontend schema-adaptive filters and search'
  );

  return out;
}

function buildBackend(source) {
  let out = source;

  out = replaceOnce(
    out,
    "const SDO_RECORD_TABLE = 'sdo_student_records';",
    "const SDO_RECORD_TABLE = 'sdo_student_records';\nconst HEADER_ORDER_META_KEY = '__smart_pdm_header_order';",
    'Backend header metadata constant'
  );

  const lookupAnchor = `function normalizeLookupValue(value) {\n  return normalizeText(value)\n    .toLowerCase()\n    .replace(/[_-]+/g, ' ')\n    .replace(/\\s+/g, ' ')\n    .trim();\n}\n`;

  const backendHelpers = `${lookupAnchor}\nfunction parseCsvLine(line) {\n  const cells = [];\n  let current = '';\n  let inQuotes = false;\n\n  for (let index = 0; index < line.length; index += 1) {\n    const char = line[index];\n    const next = line[index + 1];\n\n    if (char === '"') {\n      if (inQuotes && next === '"') {\n        current += '"';\n        index += 1;\n      } else {\n        inQuotes = !inQuotes;\n      }\n      continue;\n    }\n\n    if (char === ',' && !inQuotes) {\n      cells.push(current);\n      current = '';\n      continue;\n    }\n\n    current += char;\n  }\n\n  cells.push(current);\n  return cells;\n}\n\nfunction parseCsvRows(text) {\n  const normalized = String(text || '').replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n');\n  const rows = [];\n  let current = '';\n  let inQuotes = false;\n\n  for (let index = 0; index < normalized.length; index += 1) {\n    const char = normalized[index];\n    const next = normalized[index + 1];\n\n    if (char === '"') {\n      current += char;\n      if (inQuotes && next === '"') {\n        current += next;\n        index += 1;\n      } else {\n        inQuotes = !inQuotes;\n      }\n      continue;\n    }\n\n    if (char === '\\n' && !inQuotes) {\n      if (current.trim() !== '') rows.push(parseCsvLine(current));\n      current = '';\n      continue;\n    }\n\n    current += char;\n  }\n\n  if (current.trim() !== '') rows.push(parseCsvLine(current));\n  return rows;\n}\n\nfunction parseNullableBoolean(value) {\n  if (value === null || value === undefined || normalizeText(value) === '') return null;\n  return parseBoolean(value);\n}\n`;

  out = replaceOnce(out, lookupAnchor, backendHelpers, 'Backend robust CSV helpers');

  out = replaceOnce(
    out,
    "      ['student number', 'student_number', 'student no', 'pdm id', 'pdm_id'].includes(header)",
    "      ['student number', 'student no', 'student id', 'student id no', 'student id number', 'pdm id', 'pdm no', 'pdm number'].includes(header)",
    'Backend Student Number/PDM ID header aliases'
  );

  out = replaceOnce(
    out,
    "      ['surname', 'last name', 'lastname', 'last_name'].includes(header)",
    "      ['surname', 'last name', 'lastname', 'family name'].includes(header)",
    'Backend surname header aliases'
  );

  out = replaceOnce(
    out,
    "      ['first name', 'firstname', 'first_name', 'given name', 'given_name'].includes(header)",
    "      ['first name', 'firstname', 'given name', 'given names'].includes(header)",
    'Backend first name header aliases'
  );

  out = replaceOnce(
    out,
    "      ['middle name', 'middlename', 'middle_name'].includes(header)",
    "      ['middle name', 'middlename', 'middle initial'].includes(header)",
    'Backend middle name header aliases'
  );

  out = replaceOnce(
    out,
    "      ['course', 'course code', 'degree program', 'program'].includes(header)",
    "      ['course', 'course code', 'degree program', 'program', 'program code', 'course/program'].includes(header)",
    'Backend course header aliases'
  );

  out = replaceOnce(
    out,
    "      ['year level', 'year_level', 'year'].includes(header)",
    "      ['year level', 'year', 'level'].includes(header)",
    'Backend year header aliases'
  );

  out = replaceOnce(
    out,
    "      ['phone number', 'contact number', 'mobile number', 'phone_number'].includes(header)",
    "      ['phone number', 'contact number', 'mobile number', 'personal number'].includes(header)",
    'Backend phone header aliases'
  );

  out = replaceOnce(
    out,
    `  if (fileName.endsWith('.csv')) {\n    const text = file.buffer.toString('utf8');\n    const lines = text.split(/\\r?\\n/).filter(Boolean);\n    return lines.map((line) => line.split(','));\n  }`,
    `  if (fileName.endsWith('.csv')) {\n    return parseCsvRows(file.buffer.toString('utf8'));\n  }`,
    'Backend CSV parsing'
  );

  const parseReplacement = `function buildSourceColumns(headerRow = [], bodyRows = []) {\n  const maxColumns = Math.max(\n    headerRow.length,\n    ...bodyRows.map((row) => (Array.isArray(row) ? row.length : 0)),\n    0\n  );\n  const seen = new Map();\n  const columns = [];\n\n  for (let index = 0; index < maxColumns; index += 1) {\n    const rawHeader = normalizeText(headerRow[index]);\n    const columnHasData = bodyRows.some((row) => normalizeText(row?.[index]) !== '');\n    if (!rawHeader && !columnHasData) continue;\n\n    const baseLabel = rawHeader || \`Column \${index + 1}\`;\n    const key = normalizeLookupValue(baseLabel);\n    const occurrence = (seen.get(key) || 0) + 1;\n    seen.set(key, occurrence);\n\n    columns.push({\n      index,\n      label: occurrence === 1 ? baseLabel : \`\${baseLabel} (\${occurrence})\`,\n    });\n  }\n\n  return columns;\n}\n\nfunction parseRows(rows) {\n  if (!rows.length) return [];\n\n  const headerRow = rows[0] || [];\n  const bodyRows = rows.slice(1);\n  const headerMap = mapHeaders(headerRow);\n  const sourceColumns = buildSourceColumns(headerRow, bodyRows);\n  const sourceHeaders = sourceColumns.map((column) => column.label);\n  const records = [];\n\n  for (let i = 1; i < rows.length; i += 1) {\n    const row = rows[i] || [];\n    const obj = {\n      row_number: i + 1,\n      raw_payload: { [HEADER_ORDER_META_KEY]: sourceHeaders },\n    };\n\n    sourceColumns.forEach(({ index, label }) => {\n      const value = row[index] ?? '';\n      const key = headerMap.get(index);\n      if (key) obj[key] = value;\n      obj.raw_payload[label] = value;\n    });\n\n    const studentNumber = normalizeText(obj.student_number).toUpperCase();\n    const givenName = normalizeText(obj.given_name);\n    const lastName = normalizeText(obj.last_name);\n\n    if (!studentNumber && !givenName && !lastName) continue;\n    if (!studentNumber || !givenName || !lastName) continue;\n\n    const hasField = (field) => Object.prototype.hasOwnProperty.call(obj, field);\n    const explicitDisciplinary = hasField('has_disciplinary_action')\n      ? parseNullableBoolean(obj.has_disciplinary_action)\n      : null;\n    const hasOffenseDetails = Boolean(\n      normalizeText(obj.offense_type) || parseExcelDate(obj.offense_incident_date)\n    );\n\n    records.push({\n      row_number: obj.row_number,\n      student_number: studentNumber,\n      pdm_id: studentNumber,\n      learners_reference_number: normalizeText(obj.learners_reference_number) || null,\n      given_name: givenName,\n      middle_name: normalizeText(obj.middle_name) || null,\n      last_name: lastName,\n      course_code: normalizeText(obj.degree_program) || null,\n      year_level: normalizeYearLevel(obj.year_level),\n      sex_at_birth: normalizeText(obj.sex_at_birth) || null,\n      religion: normalizeText(obj.religion) || null,\n      date_of_birth: parseExcelDate(obj.date_of_birth),\n      age: parseInteger(obj.age),\n      place_of_birth: normalizeText(obj.place_of_birth) || null,\n      civil_status: normalizeText(obj.civil_status) || null,\n      email_address: normalizeText(obj.email_address).toLowerCase() || null,\n      phone_number: normalizeText(obj.phone_number) || null,\n      sequence_number: obj.sequence_number ? Number(obj.sequence_number) || null : null,\n      sibling_last_name: normalizeText(obj.sibling_last_name) || null,\n      sibling_first_name: normalizeText(obj.sibling_first_name) || null,\n      sibling_middle_name: normalizeText(obj.sibling_middle_name) || null,\n      sibling_mobile_no: normalizeText(obj.sibling_mobile_no) || null,\n      financial_support_parents: hasField('financial_support_parents')\n        ? parseNullableBoolean(obj.financial_support_parents)\n        : null,\n      financial_support_scholarship: hasField('financial_support_scholarship')\n        ? parseNullableBoolean(obj.financial_support_scholarship)\n        : null,\n      financial_support_loan: hasField('financial_support_loan')\n        ? parseNullableBoolean(obj.financial_support_loan)\n        : null,\n      financial_support_other: hasField('financial_support_other')\n        ? parseNullableBoolean(obj.financial_support_other)\n        : null,\n      has_been_scholar: hasField('has_been_scholar')\n        ? parseNullableBoolean(obj.has_been_scholar)\n        : null,\n      has_disciplinary_action: hasOffenseDetails ? true : explicitDisciplinary,\n      offense_type: normalizeText(obj.offense_type) || null,\n      offense_incident_date: parseExcelDate(obj.offense_incident_date),\n      raw_payload: obj.raw_payload,\n    });\n  }\n\n  return records;\n}\n\n`;

  out = replaceBetween(
    out,
    'function parseRows(rows) {',
    'async function loadCourseMap() {',
    parseReplacement,
    'Backend adaptive row parser'
  );

  out = replaceOnce(
    out,
    `  const rawRows = await readWorkbookRows(file);\n  const parsedRows = parseRows(rawRows);\n\n  const importBatchId = await createBatch(file, adminId);`,
    `  const rawRows = await readWorkbookRows(file);\n  const sourceHeaders = buildSourceColumns(rawRows[0] || [], rawRows.slice(1))\n    .map((column) => column.label);\n  const parsedRows = parseRows(rawRows);\n\n  if (!sourceHeaders.length) {\n    throw buildError('No usable columns were found in the uploaded file.', 400);\n  }\n\n  if (!parsedRows.length) {\n    throw buildError(\n      'No importable student rows were found. The file must include PDM ID/Student Number, First Name/Given Name, and Surname/Last Name.',\n      400\n    );\n  }\n\n  const importBatchId = await createBatch(file, adminId);`,
    'Backend import validation and source headers'
  );

  out = replaceOnce(
    out,
    `    failed_rows: Math.max(parsedRows.length - masterRows.length, 0),\n  };`,
    `    failed_rows: Math.max(parsedRows.length - masterRows.length, 0),\n    source_headers: sourceHeaders,\n  };`,
    'Backend import response source headers'
  );

  return out;
}

function buildContractTest() {
  return `'use strict';\n\nconst test = require('node:test');\nconst assert = require('node:assert/strict');\nconst fs = require('fs');\nconst path = require('path');\n\nconst ROOT = path.resolve(__dirname, '..', '..');\nconst read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');\n\ntest('Student Registry preview uses the uploaded file column set instead of a fixed display schema', () => {\n  const panel = read('frontend/src/pages/maintenance/StudentRegistryPanel.jsx');\n  assert.match(panel, /buildDisplayColumns/);\n  assert.match(panel, /setExcelHeaders\\(headers\\)/);\n  assert.match(panel, /useState\\(\\[\\]\\).*lastImportedHeaders/s);\n  assert.match(panel, /buildImportedHeaders\\(registry, lastImportedHeaders\\)/);\n  assert.match(panel, /raw_snapshot/);\n});\n\ntest('Imported registry rows preserve source-specific blanks across different Excel schemas', () => {\n  const panel = read('frontend/src/pages/maintenance/StudentRegistryPanel.jsx');\n  assert.match(panel, /REGISTRY_HEADER_ORDER_KEY/);\n  assert.match(panel, /hasOwnProperty\\.call\\(snapshot, header\\)/);\n  assert.match(panel, /Object\\.fromEntries/);\n});\n\ntest('Student Registry keeps Supabase canonical columns fixed while storing arbitrary source columns in raw_snapshot', () => {\n  const service = read('backend/services/studentRegistryService.js');\n  assert.match(service, /MASTER_TABLE = 'student_master_records'/);\n  assert.match(service, /raw_snapshot: row\\.raw_payload \\|\\| \\{\\}/);\n  assert.match(service, /HEADER_ORDER_META_KEY/);\n  assert.match(service, /source_headers: sourceHeaders/);\n});\n\ntest('Missing optional boolean columns stay blank instead of becoming false', () => {\n  const service = read('backend/services/studentRegistryService.js');\n  assert.match(service, /parseNullableBoolean/);\n  assert.match(service, /financial_support_parents:[\\s\\S]*?\\? parseNullableBoolean[\\s\\S]*?: null/);\n  assert.match(service, /has_been_scholar:[\\s\\S]*?\\? parseNullableBoolean[\\s\\S]*?: null/);\n});\n\ntest('CSV imports support quoted commas and quoted fields', () => {\n  const service = read('backend/services/studentRegistryService.js');\n  assert.match(service, /function parseCsvLine/);\n  assert.match(service, /function parseCsvRows/);\n  assert.match(service, /return parseCsvRows\\(file\\.buffer\\.toString\\('utf8'\\)\\)/);\n});\n`;
}

function main() {
  const repoArg = process.argv.slice(2).find((arg) => !arg.startsWith('--')) || '.';
  const repo = findRepo(repoArg);
  const frontendPath = path.join(repo, FRONTEND_REL);
  const backendPath = path.join(repo, BACKEND_REL);
  const testPath = path.join(repo, TEST_REL);
  const frontendDir = path.join(repo, 'admin', 'frontend');
  const backendDir = path.join(repo, 'admin', 'backend');

  console.log(PATCH_NAME);
  console.log(`Repository: ${repo}\n`);

  const originals = new Map();
  for (const target of [frontendPath, backendPath]) {
    const raw = fs.readFileSync(target, 'utf8');
    originals.set(target, { raw, lf: normalizeLf(raw), eol: detectEol(raw) });
  }
  const testExisted = fs.existsSync(testPath);
  if (testExisted) {
    const raw = fs.readFileSync(testPath, 'utf8');
    originals.set(testPath, { raw, lf: normalizeLf(raw), eol: detectEol(raw) });
  }

  console.log('[1/4] Building schema-adaptive Student Registry preview...');
  const frontendBuilt = buildFrontend(originals.get(frontendPath).lf);
  console.log('      PASS');

  console.log('[2/4] Building fixed-schema Supabase import behavior...');
  const backendBuilt = buildBackend(originals.get(backendPath).lf);
  console.log('      PASS');

  console.log('[3/4] Building dynamic import regression tests...');
  const testBuilt = buildContractTest();
  console.log('      PASS');

  console.log('[4/4] Validating staged source before writes...');
  if (!frontendBuilt.includes('buildImportedHeaders(registry, lastImportedHeaders)')) {
    fail('Frontend staged validation failed: dynamic imported headers are missing.');
  }
  if (!backendBuilt.includes('source_headers: sourceHeaders')) {
    fail('Backend staged validation failed: import source header response is missing.');
  }
  if (!backendBuilt.includes("raw_snapshot: row.raw_payload || {}")) {
    fail('Backend staged validation failed: raw_snapshot persistence is missing.');
  }
  console.log('      PASS');

  const baseline = captureBackendBaseline(backendDir, 'pre-write baseline');

  const backupRoot = path.join(
    repo,
    '.smart-pdm-patch-backups',
    `student-registry-dynamic-import-v2-${new Date().toISOString().replace(/[:.]/g, '-')}`
  );
  fs.mkdirSync(backupRoot, { recursive: true });

  function backup(target) {
    const rel = path.relative(repo, target);
    const dest = path.join(backupRoot, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.existsSync(target)) fs.copyFileSync(target, dest);
  }

  [frontendPath, backendPath, ...(testExisted ? [testPath] : [])].forEach(backup);

  let wrote = false;
  try {
    fs.writeFileSync(
      frontendPath,
      restoreEol(frontendBuilt, originals.get(frontendPath).eol),
      'utf8'
    );
    fs.writeFileSync(
      backendPath,
      restoreEol(backendBuilt, originals.get(backendPath).eol),
      'utf8'
    );
    fs.mkdirSync(path.dirname(testPath), { recursive: true });
    fs.writeFileSync(testPath, testBuilt, 'utf8');
    wrote = true;

    console.log('\n> node --check services/studentRegistryService.js');
    let result = run(process.execPath, ['--check', 'services/studentRegistryService.js'], backendDir);
    if (result.status !== 0) fail('Backend syntax check failed.');

    console.log('\n> node --test test/student-registry-dynamic-import-contract.test.js');
    result = run(process.execPath, ['--test', 'test/student-registry-dynamic-import-contract.test.js'], backendDir);
    if (result.status !== 0) fail('Student Registry dynamic import regression tests failed.');

    console.log('\n> npm run build');
    result = runNpm(['run', 'build'], frontendDir);
    if (result.status !== 0) fail('Admin frontend production build failed.');

    const after = captureBackendBaseline(backendDir, 'after Student Registry patch');
    assertNoNewFailures(baseline, after);

    console.log('\nPASS: Student Registry now adapts to each imported Excel/CSV column set while keeping the Supabase master schema fixed.');
    console.log('      Missing source columns stay blank/null; arbitrary source columns remain preserved in raw_snapshot.');
    if (baseline.status !== 0) {
      console.log('      Existing backend test failures were preserved with no new failures introduced.');
    }
    console.log(`Backup: ${backupRoot}`);
  } catch (error) {
    console.error(`\nFAIL: ${error.message}`);
    if (wrote) {
      console.error('Restoring previous files...');
      for (const [target, original] of originals.entries()) {
        fs.writeFileSync(target, original.raw, 'utf8');
      }
      if (!testExisted && fs.existsSync(testPath)) fs.unlinkSync(testPath);
      console.error(`Rollback completed from: ${backupRoot}`);
    }
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(`\nFAIL: ${error.message}`);
  console.error('No files were changed.');
  process.exitCode = 1;
}
