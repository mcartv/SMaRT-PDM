'use strict';

const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(process.argv[2] || process.cwd());
const checkOnly = process.argv.includes('--check');

const TEXT_EXTENSIONS = new Set([
  '.js','.jsx','.mjs','.cjs','.ts','.tsx','.json','.css','.scss','.html',
  '.md','.txt','.sql','.dart','.py','.yml','.yaml'
]);

const EXCLUDED_DIRS = new Set([
  '.git','node_modules','dist','build','coverage','.dart_tool','.idea','.vscode',
  'Pods','.gradle'
]);

const EXCLUDED_NAME_PATTERNS = [
  /\.bak$/i,/\.backup-/i,/\.before-/i,/\.orig$/i,/\.rej$/i,/test-results/i,
  /package-lock\.json$/i
];

const SUSPICIOUS_RE = /(?:Ã|Â|â|ð|ï|�|ΓÇ)/u;

const FIXES = new Map([
  ['â€¢','•'], ['â€”','—'], ['â€“','–'], ['â‚±','₱'],
  ['â€™','’'], ['â€˜','‘'], ['â€œ','“'], ['â€','”'],
  ['â€¦','…'], ['â†’','→'], ['â†','←'], ['âœ“','✓'],
  ['âœ”','✔'], ['âœ…','✅'], ['âŒ','❌'],
  ['Â·','·'], ['Â©','©'], ['Â®','®'], ['Â±','±'], ['Â°','°'],
  ['ΓÇö','—'], ['ΓÇô','–'], ['ΓÇó','•']
]);

function suspiciousScore(text) {
  const matches = text.match(/Ã|Â|â|ð|ï|�|ΓÇ/g);
  return matches ? matches.length : 0;
}

function tryLatin1RoundTrip(text) {
  const bytes = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp > 255) return null;
    bytes.push(cp);
  }
  const candidate = Buffer.from(bytes).toString('utf8');
  if (candidate.includes('\uFFFD')) return null;
  return candidate;
}

function repairLine(line) {
  if (!SUSPICIOUS_RE.test(line)) return line;

  let current = line;

  for (let pass = 0; pass < 3; pass += 1) {
    const before = current;

    for (const [bad, good] of FIXES) {
      current = current.split(bad).join(good);
    }

    // Generic repair for common mojibake such as JosÃ© -> José.
    const generic = tryLatin1RoundTrip(current);
    if (generic && suspiciousScore(generic) < suspiciousScore(current)) {
      current = generic;
      for (const [bad, good] of FIXES) {
        current = current.split(bad).join(good);
      }
    }

    if (current === before) break;
  }

  return current;
}

function repairText(text) {
  return text.split(/(\r\n|\n|\r)/).map((part) => {
    if (part === '\r\n' || part === '\n' || part === '\r') return part;
    return repairLine(part);
  }).join('');
}

function shouldSkip(filePath) {
  return EXCLUDED_NAME_PATTERNS.some((re) => re.test(path.basename(filePath)));
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith('encoding-cleanup-backup-')) continue;
      walk(path.join(dir, entry.name), out);
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (shouldSkip(fullPath)) continue;
    if (!TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    out.push(fullPath);
  }
  return out;
}

const files = walk(projectRoot);
const changed = [];
const unresolved = [];

for (const filePath of files) {
  let original;
  try {
    original = fs.readFileSync(filePath, 'utf8');
  } catch {
    continue;
  }

  if (!SUSPICIOUS_RE.test(original)) continue;

  const repaired = repairText(original);

  if (repaired !== original) {
    changed.push({
      filePath,
      relativePath: path.relative(projectRoot, filePath),
      original,
      repaired
    });
  }

  if (SUSPICIOUS_RE.test(repaired)) {
    const lines = repaired.split(/\r?\n/);
    const hits = [];
    for (let i = 0; i < lines.length; i += 1) {
      if (SUSPICIOUS_RE.test(lines[i])) {
        hits.push(`${i + 1}: ${lines[i].trim().slice(0, 160)}`);
      }
      if (hits.length >= 8) break;
    }
    unresolved.push({
      relativePath: path.relative(projectRoot, filePath),
      hits
    });
  }
}

console.log(`Scanned ${files.length} active text/source files.`);
console.log(`Files with repairs: ${changed.length}`);

for (const item of changed) {
  console.log(`  ${item.relativePath}`);
}

if (!checkOnly && changed.length) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupRoot = path.join(projectRoot, `encoding-cleanup-backup-${stamp}`);

  for (const item of changed) {
    const backupPath = path.join(backupRoot, item.relativePath);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.copyFileSync(item.filePath, backupPath);
    fs.writeFileSync(item.filePath, item.repaired, 'utf8');
  }

  console.log(`Backups saved to: ${backupRoot}`);
  console.log('Repairs written as UTF-8.');
}

if (unresolved.length) {
  console.log('');
  console.log('Manual review still recommended:');
  for (const item of unresolved) {
    console.log(`  ${item.relativePath}`);
    for (const hit of item.hits) console.log(`    ${hit}`);
  }
}

if (checkOnly) {
  console.log('Check-only mode: no files were changed.');
}

if (!changed.length && !unresolved.length) {
  console.log('No mojibake patterns were found in active source files.');
}

process.exitCode = unresolved.length ? 2 : 0;
