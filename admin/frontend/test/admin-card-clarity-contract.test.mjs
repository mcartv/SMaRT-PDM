import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const indexCss = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const adminLayout = fs.readFileSync(new URL('../src/components/layout/AdminLayout.jsx', import.meta.url), 'utf8');
const dashboard = fs.readFileSync(new URL('../src/pages/AdminDashboard.jsx', import.meta.url), 'utf8');

test('Admin exposes a theme-aware structural card border token', () => {
  assert.match(adminLayout, /--admin-card-border/);
  assert.match(adminLayout, /--admin-card-divider/);
});

test('Admin shared cards receive a clearer structural border without changing layout', () => {
  assert.match(indexCss, /smartpdm-admin-active[\s\S]*\[data-slot="card"\][\s\S]*border: 1px solid var\(--admin-card-border/);
  assert.match(indexCss, /major Admin cards a clearer edge/i);
});

test('Dashboard structural cards use the Admin clarity border token', () => {
  assert.match(dashboard, /border: 'var\(--admin-card-border, var\(--portal-border\)\)'/);
});
