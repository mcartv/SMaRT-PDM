const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const frontendRoot = path.resolve(backendRoot, '..', 'frontend', 'lib');
const read = (...parts) => fs.readFileSync(path.join(frontendRoot, ...parts), 'utf8');

const messagingProvider = read('features','messaging','presentation','providers','messaging_provider.dart');
const messaging = read('features','messaging','presentation','screens','messaging_screen.dart');
const chatList = read('features','messaging','presentation','screens','chat_list_screen.dart');
const notificationProvider = read('features','notifications','presentation','providers','notification_provider.dart');
const notifications = read('features','notifications','presentation','screens','notifications_screen.dart');
const announcements = read('features','applicant','presentation','screens','announcements_screen.dart');
const payout = read('features','scholar','presentation','screens','payout_schedule_screen.dart');
const renewal = read('features','applicant','presentation','screens','scholar_renewal_requirements_screen.dart');
const about = read('features','profile','presentation','screens','about_pdm_screen.dart');

test('payout cards are closed by default but stay expandable', () => {
  assert.match(payout, /_expandedPayouts/);
  assert.match(payout, /AnimatedSize/);
  assert.doesNotMatch(payout, /_initializedPayoutExpansion/);
  assert.doesNotMatch(payout, /_expandedPayouts\.add\(items\.first\.payoutEntryId\)/);
});

test('renewal unavailable state is semester-based and visually intentional', () => {
  assert.match(renewal, /Renewal is not required for this semester because your scholarship is already active/);
  assert.match(renewal, /Renewal is only needed for the next semester/);
  assert.match(renewal, /Widget _buildPeriodCard/);
  assert.doesNotMatch(renewal, /belongs to this semester/);
  assert.doesNotMatch(renewal, /'OSFA Feedback'/);
});

test('About information is expandable except About this app', () => {
  assert.match(about, /class _AboutHeroSection/);
  assert.match(about, /initiallyExpanded: true/);
  assert.match(about, /class _AboutExpandableSection/);
  assert.match(about, /class _MissionVisionSection/);
  assert.match(about, /class _WhatYouCanDoRows/);
  const footer = about.slice(about.indexOf('class _AboutThisAppCard'));
  assert.doesNotMatch(footer, /ExpansionTile\(/);
});

test('messaging errors are actionable and do not expose backend wording', () => {
  assert.match(messagingProvider, /Your message is too long\. Shorten it and try again/);
  assert.match(messagingProvider, /We could not connect to messages/);
  assert.match(messagingProvider, /We could not complete that messaging action/);
  assert.doesNotMatch(messagingProvider, /The messaging server took too long/);
  assert.match(messaging, /We could not send your message/);
  assert.match(chatList, /Archived Messages/);
});

test('notifications use student-facing categories and safe errors', () => {
  assert.match(notificationProvider, /String _readableError/);
  assert.match(notificationProvider, /We could not update notifications/);
  assert.match(notifications, /String _notificationTypeLabel/);
  assert.match(notifications, /Scholarship Opening/);
  assert.match(notifications, /Obligation/);
  assert.match(notifications, /We could not delete this notification/);
  assert.doesNotMatch(notifications, /Failed to delete notification:/);
});

test('announcements use simple filters and safe load errors', () => {
  assert.match(announcements, /For You/);
  assert.match(announcements, /Read more/);
  assert.match(announcements, /We could not load announcements/);
  assert.doesNotMatch(announcements, /replaceFirst\('Exception: '/);
});
