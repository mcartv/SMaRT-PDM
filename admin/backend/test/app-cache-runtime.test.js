'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const appCache = require('../config/appCache');

test('shared app cache stores, hits, and invalidates by namespace', () => {
  appCache.clearAll();

  const key = appCache.buildKey({
    namespace: 'courses',
    scopeKey: 'user:test:admin',
    pathname: '/api/courses',
    queryKey: '',
  });

  assert.equal(appCache.getJson(key), null);

  assert.equal(
    appCache.setJson(
      key,
      {
        namespace: 'courses',
        statusCode: 200,
        body: [{ course_id: '1', course_name: 'BSIT' }],
      },
      5000
    ),
    true
  );

  const hit = appCache.getJson(key);
  assert.equal(hit.statusCode, 200);
  assert.deepEqual(JSON.parse(hit.bodyText), [
    { course_id: '1', course_name: 'BSIT' },
  ]);

  assert.equal(appCache.invalidateNamespaces(['courses']), 1);
  assert.equal(appCache.getJson(key), null);
});

test('namespace invalidation does not clear unrelated cached modules', () => {
  appCache.clearAll();

  const courseKey = appCache.buildKey({
    namespace: 'courses',
    scopeKey: 'public',
    pathname: '/courses',
  });
  const openingKey = appCache.buildKey({
    namespace: 'program-openings',
    scopeKey: 'public',
    pathname: '/openings',
  });

  appCache.setJson(courseKey, {
    namespace: 'courses',
    body: ['course'],
  }, 5000);

  appCache.setJson(openingKey, {
    namespace: 'program-openings',
    body: ['opening'],
  }, 5000);

  appCache.invalidateNamespaces(['courses']);

  assert.equal(appCache.getJson(courseKey), null);
  assert.ok(appCache.getJson(openingKey));
});


test('Supabase postgres_changes invalidates matching cache before realtime handler runs', () => {
  appCache.clearAll();

  const key = appCache.buildKey({
    namespace: 'applications',
    scopeKey: 'user:test:admin',
    pathname: '/api/applications',
  });

  appCache.setJson(key, {
    namespace: 'applications',
    body: [{ application_id: 'old' }],
  }, 5000);

  let wrappedHandler = null;
  const channel = {
    on(eventName, filter, handler) {
      wrappedHandler = handler;
      return this;
    },
  };
  const supabase = {
    channel() {
      return channel;
    },
  };

  appCache.installSupabaseRealtimeInvalidation(supabase);

  let handlerSawCache = true;
  supabase
    .channel('test')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'applications' },
      () => {
        handlerSawCache = Boolean(appCache.getJson(key));
      }
    );

  wrappedHandler({ eventType: 'UPDATE' });

  assert.equal(handlerSawCache, false);
  assert.equal(appCache.getJson(key), null);
});
