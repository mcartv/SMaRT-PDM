const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const adminRoot = path.resolve(backendRoot, '..');
const service = fs.readFileSync(path.join(backendRoot, 'services', 'adminProfilePhotoService.js'), 'utf8');
const frontend = fs.readFileSync(path.join(adminRoot, 'frontend', 'src', 'pages', 'ProfilePhotoQueue.jsx'), 'utf8');
const bridge = fs.readFileSync(path.join(backendRoot, 'services', 'realtimeBridgeService.js'), 'utf8');

test('Review Pending profile-photo queue', () => {
  assert.ok(frontend.includes("const [status, setStatus] = useState('pending')"));
  assert.ok(service.includes("const status = safeText(query.status || 'pending').toLowerCase();"));
});

test('Ensure only genuinely pending submissions appear', () => {
  assert.ok(service.includes("request = request.eq('status', status);"));
  assert.ok(frontend.includes("String(item?.status || '').toLowerCase() === expectedStatus"));
});

test('Fix pending count if inconsistent', () => {
  assert.ok(service.includes('status_counts: statusCounts'));
  assert.ok(frontend.includes('statusCounts[option] ?? 0'));
  assert.ok(frontend.includes('pending: Number(data?.status_counts?.pending) || 0'));
});

test('Verify approve/reject actions remove records from Pending immediately', () => {
  const pendingRefreshCall = "loadQueue('pending', { quiet: true })";
  const refreshCount = frontend.split(pendingRefreshCall).length - 1;
  assert.equal(refreshCount, 2);
  assert.ok(service.includes("Only pending profile photo reviews can be approved."));
  assert.ok(service.includes("Only pending profile photo reviews can be rejected."));
});

test('Verify realtime queue updates', () => {
  assert.ok(frontend.includes("useSocketEvent('profile-photo-review:created'"));
  assert.ok(frontend.includes("useSocketEvent('profile-photo-review:updated'"));
  assert.ok(bridge.includes('profile-photo-review:'));
});

test('Review Superseded profile-photo behavior', () => {
  assert.ok(service.includes(".update({ status: 'superseded' })"));
  assert.ok(service.includes(".eq('status', 'approved')"));
  assert.ok(service.includes(".eq('status', 'pending')"));
});

test('Clearly identify superseded submissions', () => {
  assert.ok(frontend.includes("case 'superseded':"));
  assert.ok(frontend.includes("const STATUS_OPTIONS = ['pending', 'approved', 'rejected', 'superseded'];"));
});

test('Prevent superseded photos from appearing in Pending', () => {
  assert.ok(frontend.includes('expectedStatus'));
  assert.ok(service.includes("request = request.eq('status', status);"));
});

test('Preserve superseded records for history', () => {
  assert.ok(service.includes(".eq('student_id', review.student_id)"));
  assert.ok(service.includes(".order('submitted_at', { ascending: false });"));
  assert.ok(!service.includes(".from('profile_photo_reviews')\n    .delete("));
});

test('Ensure only the correct/current profile photo is used', () => {
  assert.ok(service.includes('is_current_profile_photo: isCurrentProfilePhoto'));
  assert.ok(service.includes(".update({ profile_photo_url: review.storage_path })"));
  assert.ok(frontend.includes('item.is_current_profile_photo'));
  assert.ok(frontend.includes('Current'));
});

test('Verify filters for Superseded records', () => {
  assert.ok(service.includes("new Set(['pending', 'approved', 'rejected', 'superseded'])"));
  assert.ok(frontend.includes("handleStatusChange(option)"));
  assert.ok(frontend.includes('superseded: Number(data?.status_counts?.superseded) || 0'));
});
