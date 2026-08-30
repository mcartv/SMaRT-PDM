import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

test('Admin structural borders use neutral palette instead of portal theme colors', () => {
  assert.match(
    css,
    /html\.smartpdm-admin-active \.portal-shell \{[\s\S]*?--portal-border:\s*var\(--border-default\)\s*!important;/,
  );
  assert.match(
    css,
    /html\.smartpdm-admin-active\.smartpdm-force-dark \.portal-shell \{[\s\S]*?--border-default:\s*#3e4042\s*!important;/,
  );
});

test('Admin ordinary outline buttons use neutral borders while semantic colors remain excluded', () => {
  const adminOutlineRules = css.slice(css.lastIndexOf('Admin neutral structural outlines'));
  assert.match(adminOutlineRules, /\[data-slot="button"\]\[data-variant="outline"\]/);
  assert.match(adminOutlineRules, /border-color:\s*var\(--border-default\)\s*!important;/);
  assert.match(adminOutlineRules, /border-color:\s*var\(--border-strong\)\s*!important;/);
  assert.match(adminOutlineRules, /\.border-red-200/);
  assert.match(adminOutlineRules, /\.border-emerald-200/);
  assert.match(adminOutlineRules, /\.border-blue-200/);
  assert.match(adminOutlineRules, /class\*="border-\[var\(--portal-base\)\]"/);
});
