'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('admin connection gate exposes the complete branded state experience', () => {
  const gate = read('frontend/src/components/system/NetworkGate.jsx');
  const styles = read('frontend/src/components/system/NetworkGate.css');

  assert.match(gate, /loading:\s*\{[\s\S]*Loading SMaRT-PDM[\s\S]*Preparing your portal\. Please wait a moment\./);
  assert.match(gate, /slow:\s*\{[\s\S]*Taking a little longer[\s\S]*The server is taking longer than usual to respond\. Please wait while we reconnect\./);
  assert.match(gate, /offline:\s*\{[\s\S]*No internet connection[\s\S]*Check your internet connection, then try again\./);
  assert.match(gate, /server_error:\s*\{[\s\S]*Unable to connect[\s\S]*SMaRT-PDM is temporarily unavailable\. Please try again in a moment\./);
  assert.match(gate, /SLOW_CONNECTION_MS\s*=\s*10_000/);
  assert.match(gate, /PUBLIC_CONNECT_GRACE_MS\s*=\s*90_000/);
  assert.match(gate, /navigator\.onLine \? 'server_error' : 'offline'/);
  assert.match(gate, /response\.status === 401 \|\| response\.status === 403/);
  assert.match(gate, /Retrying\.\.\.[\s\S]*Try Again/);
  assert.doesNotMatch(gate, /Establishing a secure connection|Securely connecting|Protected connection/);

  assert.doesNotMatch(gate, /linearGradient|strokeDasharray|smartpdm-primary-orbit/);
  assert.match(gate, /smartpdm-logo-pulse/);
  assert.match(gate, /\{isError \? \(/);
  assert.match(gate, /className="sr-only"/);
  assert.doesNotMatch(gate, /smartpdm-segmented-ring|conic-gradient/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /smartpdm-screen-exit 300ms/);
  assert.match(styles, /smartpdm-logo-pulse 3s cubic-bezier/);
});

test('protected-route loading keeps auth invalidation separate from connection failures', () => {
  const route = read('frontend/src/components/auth/ProtectedRoute.jsx');

  assert.match(route, /SLOW_VALIDATION_MS\s*=\s*10_000/);
  assert.match(route, /VALIDATION_ERROR_AFTER_MS\s*=\s*60_000/);
  assert.match(route, /error\.code === 'NETWORK_ERROR'[\s\S]*setConnectionState/);
  assert.match(route, /isSessionInvalidationError\(error\)/);
  assert.match(route, /status=\{connectionState\}/);
});
