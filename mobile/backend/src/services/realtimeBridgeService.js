let realtimeChannel = null;
let realtimeChannelGeneration = 0;
let realtimeRetryTimer = null;
const REALTIME_BRIDGE_RETRY_MS = 3000;

function clearRealtimeRetry() {
  if (!realtimeRetryTimer) return;
  clearTimeout(realtimeRetryTimer);
  realtimeRetryTimer = null;
}

function scheduleRealtimeBridgeRestart({ io, supabase, reason }) {
  if (realtimeRetryTimer) return;

  console.warn('[Realtime Bridge] scheduling reconnect:', {
    reason: String(reason || 'unknown'),
    retry_in_ms: REALTIME_BRIDGE_RETRY_MS,
  });

  realtimeRetryTimer = setTimeout(() => {
    realtimeRetryTimer = null;

    try {
      configureRealtimeBridge({ io, supabase });
    } catch (error) {
      console.error(
        '[Realtime Bridge] reconnect failed:',
        error?.message || error
      );

      scheduleRealtimeBridgeRestart({
        io,
        supabase,
        reason: error?.message || 'restart_failed',
      });
    }
  }, REALTIME_BRIDGE_RETRY_MS);

  if (typeof realtimeRetryTimer.unref === 'function') {
    realtimeRetryTimer.unref();
  }
}


// Exact-event suppression only. Genuine realtime changes are still delivered
// immediately; only the same event/entity/version emitted twice is dropped.
const REALTIME_EVENT_DEDUPE_TTL_MS = 1500;
const REALTIME_EVENT_DEDUPE_MAX = 1000;
const recentRealtimeEvents = new Map();

function buildRealtimeEventKey(eventName, payload = {}) {
  const entityId =
    payload.application_id ||
    payload.document_id ||
    payload.slip_id ||
    payload.notification_id ||
    payload.announcement_id ||
    payload.opening_id ||
    payload.message_id ||
    payload.renewal_id ||
    payload.renewal_document_id ||
    payload.payout_entry_id ||
    payload.payout_proof_id ||
    '';

  const version =
    payload.updated_at ||
    payload.created_at ||
    payload.event_type ||
    '';

  if (!entityId || !version) return '';
  return `${eventName}:${entityId}:${version}`;
}

function shouldSuppressRealtimeDuplicate(eventName, payload = {}) {
  const key = buildRealtimeEventKey(eventName, payload);
  if (!key) return false;

  const now = Date.now();
  const seenAt = recentRealtimeEvents.get(key);

  if (seenAt && now - seenAt < REALTIME_EVENT_DEDUPE_TTL_MS) {
    return true;
  }

  recentRealtimeEvents.set(key, now);

  if (recentRealtimeEvents.size > REALTIME_EVENT_DEDUPE_MAX) {
    for (const [storedKey, storedAt] of recentRealtimeEvents.entries()) {
      if (now - storedAt >= REALTIME_EVENT_DEDUPE_TTL_MS) {
        recentRealtimeEvents.delete(storedKey);
      }
      if (recentRealtimeEvents.size <= REALTIME_EVENT_DEDUPE_MAX) break;
    }
  }

  return false;
}
function safeText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function normalizeText(value) {
  return safeText(value).toLowerCase();
}

function getRecordId(next = {}, old = {}, keys = []) {
  for (const key of keys) {
    const value = next?.[key] || old?.[key];
    if (value) return value;
  }

  return null;
}

function emitGlobal(io, eventName, payload) {
  if (!io || !eventName) return;
  if (shouldSuppressRealtimeDuplicate(eventName, payload)) return;
console.log('[Socket Emit]', eventName, payload);
  io.emit(eventName, payload);
}

function emitToUser(io, userId, eventName, payload) {
  if (!io || !userId || !eventName) return;
  if (shouldSuppressRealtimeDuplicate(eventName, payload)) return;

  console.log('[Socket Emit User]', `user:${userId}`, eventName, payload);
  io.to(`user:${userId}`).emit(eventName, payload);
}

const REALTIME_LOOKUP_TTL_MS = 10 * 60 * 1000;
const REALTIME_LOOKUP_MAX = 2000;
const realtimeLookupCache = new Map();

function getCachedRealtimeLookup(key) {
  const cached = realtimeLookupCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    realtimeLookupCache.delete(key);
    return null;
  }
  return cached.value || null;
}

function setCachedRealtimeLookup(key, value) {
  if (!key || !value) return;
  realtimeLookupCache.set(key, {
    value,
    expiresAt: Date.now() + REALTIME_LOOKUP_TTL_MS,
  });

  if (realtimeLookupCache.size > REALTIME_LOOKUP_MAX) {
    const now = Date.now();
    for (const [storedKey, stored] of realtimeLookupCache.entries()) {
      if (stored.expiresAt <= now) realtimeLookupCache.delete(storedKey);
      if (realtimeLookupCache.size <= REALTIME_LOOKUP_MAX) break;
    }
  }
}

async function resolveStudentUserId(supabase, studentId) {
  const normalizedStudentId = safeText(studentId);
  if (!normalizedStudentId || !supabase) return null;

  const cacheKey = `student-user:${normalizedStudentId}`;
  const cached = getCachedRealtimeLookup(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('students')
    .select('user_id')
    .eq('student_id', normalizedStudentId)
    .maybeSingle();

  if (error) {
    console.warn('[Realtime Bridge] student user lookup failed:', {
      studentId: normalizedStudentId,
      error: error.message,
    });
    return null;
  }

  const userId = safeText(data?.user_id);
  if (userId) setCachedRealtimeLookup(cacheKey, userId);
  return userId || null;
}

async function resolveApplicationStudentId(supabase, applicationId) {
  const normalizedId = safeText(applicationId);
  if (!normalizedId || !supabase) return null;

  const cacheKey = `application-student:${normalizedId}`;
  const cached = getCachedRealtimeLookup(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('applications')
    .select('student_id')
    .eq('application_id', normalizedId)
    .maybeSingle();

  if (error) return null;
  const studentId = safeText(data?.student_id);
  if (studentId) setCachedRealtimeLookup(cacheKey, studentId);
  return studentId || null;
}

async function resolveRenewalStudentId(supabase, renewalId) {
  const normalizedId = safeText(renewalId);
  if (!normalizedId || !supabase) return null;

  const cacheKey = `renewal-student:${normalizedId}`;
  const cached = getCachedRealtimeLookup(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('renewals')
    .select('student_id')
    .eq('renewal_id', normalizedId)
    .maybeSingle();

  if (error) return null;
  const studentId = safeText(data?.student_id);
  if (studentId) setCachedRealtimeLookup(cacheKey, studentId);
  return studentId || null;
}

async function resolveRoStudentId(supabase, roId) {
  const normalizedId = safeText(roId);
  if (!normalizedId || !supabase) return null;

  const cacheKey = `ro-student:${normalizedId}`;
  const cached = getCachedRealtimeLookup(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('return_of_obligations')
    .select('student_id')
    .eq('ro_id', normalizedId)
    .maybeSingle();

  if (error) return null;
  const studentId = safeText(data?.student_id);
  if (studentId) setCachedRealtimeLookup(cacheKey, studentId);
  return studentId || null;
}

async function emitToStudent(
  io,
  supabase,
  studentId,
  eventName,
  payload,
  { fallbackGlobal = true } = {}
) {
  const normalizedStudentId = safeText(studentId);
  const userId = await resolveStudentUserId(supabase, normalizedStudentId);

  if (userId) {
    emitToUser(io, userId, eventName, {
      ...payload,
      student_id: normalizedStudentId || payload?.student_id || null,
      user_id: userId,
      userId,
    });
    return true;
  }

  if (fallbackGlobal) {
    emitGlobal(io, eventName, payload);
  }
  return false;
}

function rowChanged(next = {}, old = {}, keys = [], eventType = '') {
  if (safeText(eventType).toUpperCase() !== 'UPDATE') return true;
  return keys.some((key) => next?.[key] !== old?.[key]);
}

function buildAnnouncementPayload(row = {}, fallback = {}) {
  const announcementId =
    row.announcement_id ||
    fallback.announcement_id ||
    fallback.announcementId ||
    fallback.reference_id ||
    fallback.referenceId ||
    null;

  return {
    announcement_id: announcementId,
    announcementId: announcementId,
    reference_id: announcementId,
    referenceId: announcementId,
    reference_type: 'announcement',
    referenceType: 'announcement',
    status: row.status || fallback.status || null,
    is_archived:
      row.is_archived === true ||
      fallback.is_archived === true ||
      fallback.isArchived === true,
    subject: row.subject || fallback.subject || null,
    updated_at: row.updated_at || fallback.updated_at || new Date().toISOString(),
  };
}

function handleAnnouncementChange(io, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};

  const announcementId = getRecordId(next, old, ['announcement_id']);

  console.log('[Realtime Bridge] announcements change:', {
    eventType,
    announcementId,
    nextStatus: next.status,
    oldStatus: old.status,
    nextArchived: next.is_archived,
    oldArchived: old.is_archived,
  });

  if (!announcementId) {
    console.warn('[Realtime Bridge] announcement change skipped: missing announcement_id');
    return;
  }

  let eventName = 'announcement:updated';

  if (eventType === 'INSERT') {
    eventName =
      next.status === 'Published'
        ? 'announcement:published'
        : 'announcement:created';
  }

  if (eventType === 'UPDATE') {
    if (next.is_archived === true) {
      eventName = 'announcement:archived';
    } else if (old.is_archived === true && next.is_archived === false) {
      eventName = 'announcement:restored';
    } else if (next.status === 'Published' && old.status !== 'Published') {
      eventName = 'announcement:published';
    } else {
      eventName = 'announcement:updated';
    }
  }

  if (eventType === 'DELETE') {
    eventName = 'announcement:deleted';
  }

  const eventPayload = buildAnnouncementPayload(
    eventType === 'DELETE' ? old : next,
    {
      announcement_id: announcementId,
      status: next.status || old.status || null,
      is_archived: next.is_archived ?? old.is_archived ?? null,
      subject: next.subject || old.subject || null,
    }
  );

  emitGlobal(io, eventName, eventPayload);
}

function buildNotificationPayload(row = {}, fallback = {}) {
  const notificationId =
    row.notification_id ||
    fallback.notification_id ||
    fallback.notificationId ||
    null;

  const referenceId =
    row.reference_id ||
    fallback.reference_id ||
    fallback.referenceId ||
    null;

  return {
    notification_id: notificationId,
    notificationId,
    user_id: row.user_id || fallback.user_id || fallback.userId || null,
    userId: row.user_id || fallback.user_id || fallback.userId || null,
    type: row.type || fallback.type || 'General',
    title: row.title || fallback.title || '',
    message: row.message || fallback.message || '',
    reference_id: referenceId,
    referenceId,
    reference_type: row.reference_type || fallback.reference_type || fallback.referenceType || null,
    referenceType: row.reference_type || fallback.reference_type || fallback.referenceType || null,
    is_read: row.is_read === true || fallback.is_read === true || false,
    isRead: row.is_read === true || fallback.is_read === true || false,
    push_sent: row.push_sent === true || fallback.push_sent === true || false,
    pushSent: row.push_sent === true || fallback.push_sent === true || false,
    created_at: row.created_at || fallback.created_at || new Date().toISOString(),
    createdAt: row.created_at || fallback.created_at || new Date().toISOString(),
  };
}

function handleNotificationChange(io, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};

  const notificationId = getRecordId(next, old, ['notification_id']);
  const userId = next.user_id || old.user_id || null;

  console.log('[Realtime Bridge] notifications change:', {
    eventType,
    notificationId,
    userId,
    referenceType: next.reference_type || old.reference_type,
    referenceId: next.reference_id || old.reference_id,
  });

  if (!notificationId) {
    console.warn('[Realtime Bridge] notification change skipped: missing notification_id');
    return;
  }

  let eventName = 'notification:updated';

  if (eventType === 'INSERT') eventName = 'notification:new';
  if (eventType === 'UPDATE') eventName = 'notification:updated';
  if (eventType === 'DELETE') eventName = 'notification:deleted';

  const eventPayload = buildNotificationPayload(
    eventType === 'DELETE' ? old : next,
    {
      notification_id: notificationId,
      user_id: userId,
    }
  );

  if (userId) {
    emitToUser(io, userId, eventName, eventPayload);
  } else {
    emitGlobal(io, eventName, eventPayload);
  }
}

function buildOpeningPayload(row = {}, fallback = {}) {
  const openingId =
    row.opening_id ||
    fallback.opening_id ||
    fallback.openingId ||
    fallback.reference_id ||
    fallback.referenceId ||
    null;

  return {
    opening_id: openingId,
    openingId,
    reference_id: openingId,
    referenceId: openingId,
    reference_type: 'program_opening',
    referenceType: 'program_opening',
    posting_status: row.posting_status || fallback.posting_status || null,
    postingStatus: row.posting_status || fallback.posting_status || null,
    is_archived:
      row.is_archived === true ||
      fallback.is_archived === true ||
      fallback.isArchived === true,
    opening_title: row.opening_title || fallback.opening_title || null,
    openingTitle: row.opening_title || fallback.opening_title || null,
    updated_at: row.updated_at || fallback.updated_at || new Date().toISOString(),
  };
}

function handleOpeningChange(io, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};

  const openingId = getRecordId(next, old, ['opening_id']);

  console.log('[Realtime Bridge] program_openings change:', {
    eventType,
    openingId,
    nextStatus: next.posting_status,
    oldStatus: old.posting_status,
    nextArchived: next.is_archived,
    oldArchived: old.is_archived,
  });

  if (!openingId) {
    console.warn('[Realtime Bridge] opening change skipped: missing opening_id');
    return;
  }

  let eventName = 'opening:updated';

  if (eventType === 'INSERT') {
    eventName = 'opening:created';
  }

  if (eventType === 'UPDATE') {
    if (next.is_archived === true) {
      eventName = 'opening:archived';
    } else if (old.is_archived === true && next.is_archived === false) {
      eventName = 'opening:restored';
    } else if (next.posting_status === 'closed') {
      eventName = 'opening:closed';
    } else {
      eventName = 'opening:updated';
    }
  }

  if (eventType === 'DELETE') {
    eventName = 'opening:archived';
  }

  const eventPayload = buildOpeningPayload(
    eventType === 'DELETE' ? old : next,
    {
      opening_id: openingId,
      posting_status: next.posting_status || old.posting_status || null,
      is_archived: next.is_archived ?? old.is_archived ?? null,
      opening_title: next.opening_title || old.opening_title || null,
    }
  );

  emitGlobal(io, eventName, eventPayload);

  /*
    Opening updates can affect Office Updates, so force refresh too.
  */
  emitGlobal(io, 'announcement:refresh', {
    ...eventPayload,
    source_event: eventName,
    sourceEvent: eventName,
  });
}

async function handleApplicationChange(io, supabase, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;
  const applicationId = getRecordId(next, old, ['application_id']);

  if (!applicationId) return;

  const studentId = row.student_id || null;
  const eventPayload = {
    application_id: applicationId,
    student_id: studentId,
    opening_id: row.opening_id || null,
    application_status: row.application_status || null,
    document_status: row.document_status || null,
    verification_status: row.verification_status || null,
    selection_status: row.selection_status || null,
    activation_status: row.activation_status || null,
    updated_at: row.updated_at || row.activated_at || new Date().toISOString(),
    event_type: eventType,
  };

  await emitToStudent(
    io,
    supabase,
    studentId,
    'application:updated',
    eventPayload
  );

  const previousStatus = normalizeText(old.application_status);
  const nextStatus = normalizeText(next.application_status);
  const activationChanged =
    normalizeText(next.activation_status) === 'activated' &&
    normalizeText(old.activation_status) !== 'activated';

  if (
    (nextStatus === 'approved' && previousStatus !== 'approved') ||
    activationChanged
  ) {
    await emitToStudent(
      io,
      supabase,
      studentId,
      'application:approved',
      eventPayload
    );
  } else if (
    ['rejected', 'disqualified', 'declined'].includes(nextStatus) &&
    previousStatus !== nextStatus
  ) {
    await emitToStudent(
      io,
      supabase,
      studentId,
      'application:rejected',
      eventPayload
    );
  }
}

async function handleApplicationDocumentChange(io, supabase, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;
  const applicationId = row.application_id || null;

  if (!applicationId) return;

  const studentId =
    row.uploaded_by ||
    (await resolveApplicationStudentId(supabase, applicationId));

  const eventPayload = {
    application_id: applicationId,
    student_id: studentId || null,
    document_id: row.document_id || null,
    document_key: row.document_type || null,
    document_name: row.document_type || null,
    document_status: row.review_status || null,
    is_submitted: row.is_submitted === true,
    updated_at: row.updated_at || row.submitted_at || new Date().toISOString(),
    event_type: eventType,
    source: 'application_document',
  };

  const reviewChanged =
    eventType === 'UPDATE' &&
    normalizeText(next.review_status) !== normalizeText(old.review_status);

  await emitToStudent(
    io,
    supabase,
    studentId,
    reviewChanged
      ? 'application-document:reviewed'
      : 'application-document:uploaded',
    eventPayload
  );
}

async function handleApplicationDocumentReviewChange(io, supabase, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;
  const applicationId = row.application_id || null;

  if (!applicationId) return;

  const studentId = await resolveApplicationStudentId(
    supabase,
    applicationId
  );

  await emitToStudent(
    io,
    supabase,
    studentId,
    'application-document:reviewed',
    {
      application_id: applicationId,
      student_id: studentId || null,
      document_id: row.document_id || row.review_id || null,
      document_key: row.document_key || row.document_type || null,
      document_status: row.review_status || row.status || null,
      updated_at:
        row.updated_at || row.reviewed_at || new Date().toISOString(),
      event_type: eventType,
      source: 'application_document_review',
    }
  );
}

async function handleRenewalChange(io, supabase, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;
  const renewalId = row.renewal_id || null;
  if (!renewalId) return;

  const currentStatus = normalizeText(next.status || next.renewal_status);
  const previousStatus = normalizeText(old.status || old.renewal_status);
  let eventName =
    eventType === 'INSERT' ? 'renewal:created' : 'renewal:updated';

  if (currentStatus === 'approved' && previousStatus !== 'approved') {
    eventName = 'renewal:approved';
  } else if (
    currentStatus === 'rejected' &&
    previousStatus !== 'rejected'
  ) {
    eventName = 'renewal:rejected';
  }

  await emitToStudent(io, supabase, row.student_id, eventName, {
    renewal_id: renewalId,
    student_id: row.student_id || null,
    renewal_status: row.status || row.renewal_status || null,
    updated_at: row.updated_at || row.reviewed_at || new Date().toISOString(),
    event_type: eventType,
  });
}

async function handleRenewalDocumentChange(io, supabase, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;
  if (!row.renewal_id) return;

  const studentId = await resolveRenewalStudentId(
    supabase,
    row.renewal_id
  );

  await emitToStudent(io, supabase, studentId, 'renewal:updated', {
    renewal_id: row.renewal_id,
    student_id: studentId || null,
    renewal_document_id: row.renewal_document_id || null,
    document_status: row.review_status || row.status || null,
    updated_at:
      row.updated_at ||
      row.reviewed_at ||
      row.submitted_at ||
      new Date().toISOString(),
    event_type: eventType,
    source: 'renewal_document',
  });
}

async function handlePayoutChange(io, supabase, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;
  const payoutEntryId = row.payout_entry_id || null;
  if (!payoutEntryId) return;

  const eventName =
    eventType === 'DELETE' ? 'payout:deleted' : 'payout:updated';

  await emitToStudent(io, supabase, row.student_id, eventName, {
    payout_entry_id: payoutEntryId,
    payout_batch_id: row.payout_batch_id || null,
    student_id: row.student_id || null,
    release_status: row.release_status || null,
    amount_received: row.amount_received ?? null,
    updated_at: row.updated_at || row.released_at || new Date().toISOString(),
    event_type: eventType,
  });
}

async function handlePayoutProofChange(io, supabase, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;
  if (!row.payout_entry_id) return;

  const eventPayload = {
    payout_entry_id: row.payout_entry_id,
    payout_batch_id: row.payout_batch_id || null,
    payout_proof_id: row.payout_proof_id || null,
    student_id: row.student_id || null,
    proof_status: row.proof_status || null,
    updated_at:
      row.updated_at ||
      row.reviewed_at ||
      row.submitted_at ||
      new Date().toISOString(),
    event_type: eventType,
    source: 'payout_proof',
  };

  await emitToStudent(
    io,
    supabase,
    row.student_id,
    'payout:updated',
    eventPayload
  );

  if (eventType === 'INSERT') {
    await emitToStudent(
      io,
      supabase,
      row.student_id,
      'payout:proof-submitted',
      eventPayload
    );
    return;
  }

  if (
    eventType === 'UPDATE' &&
    normalizeText(next.proof_status) !== normalizeText(old.proof_status)
  ) {
    await emitToStudent(
      io,
      supabase,
      row.student_id,
      'payout:proof-reviewed',
      eventPayload
    );
  }
}

async function handleEndorsementChange(io, supabase, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;
  const slipId = getRecordId(next, old, ['slip_id']);

  if (!slipId || !row.application_id) return;

  const eventPayload = {
    slip_id: slipId,
    application_id: row.application_id,
    student_id: row.student_id || null,
    current_stage: row.current_stage || null,
    overall_status: row.overall_status || null,
    sdo_status: row.sdo_status || null,
    guidance_status: row.guidance_status || null,
    pd_status: row.pd_status || null,
    updated_at:
      row.updated_at || row.completed_at || new Date().toISOString(),
    event_type: eventType,
  };

  await emitToStudent(
    io,
    supabase,
    row.student_id,
    'endorsement:updated',
    eventPayload
  );
}

function handleProfileChange(io, payload = {}, source = 'profile') {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;
  const userId = row.user_id || null;
  const eventPayload = {
    user_id: userId,
    student_id: row.student_id || null,
    updated_at: row.updated_at || row.reviewed_at || new Date().toISOString(),
    event_type: eventType,
    source,
  };

  if (userId) emitToUser(io, userId, 'profile:updated', eventPayload);
  else emitGlobal(io, 'profile:updated', eventPayload);
}

async function handleRoAssignmentChange(io, supabase, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;
  const roId = row.ro_id || null;
  if (!roId) return;

  const currentStatus = normalizeText(row.ro_status || row.assignment_status);
  let eventName = eventType === 'INSERT' ? 'ro:created' : 'ro:updated';

  if (currentStatus === 'cleared' || currentStatus === 'completed') {
    eventName = 'ro:cleared';
  } else if (normalizeText(row.assignment_status) === 'assigned') {
    eventName = 'ro:assigned';
  } else if (normalizeText(row.assignment_status) === 'acknowledged') {
    eventName = 'ro:acknowledged';
  }

  const eventPayload = {
    ro_id: roId,
    student_id: row.student_id || null,
    assignment_status: row.assignment_status || null,
    progress_status: row.progress_status || null,
    ro_status: row.ro_status || null,
    submitted_minutes: row.submitted_minutes ?? null,
    validated_minutes: row.validated_minutes ?? null,
    updated_at: row.updated_at || new Date().toISOString(),
    event_type: eventType,
  };

  await emitToStudent(
    io,
    supabase,
    row.student_id,
    eventName,
    eventPayload
  );
  await emitToStudent(
    io,
    supabase,
    row.student_id,
    'ro:assignment-updated',
    eventPayload
  );
}

async function handleRoLogChange(io, supabase, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;
  if (!row.log_id && !row.ro_id) return;

  const eventPayload = {
    log_id: row.log_id || null,
    ro_id: row.ro_id || null,
    student_id: row.student_id || null,
    log_status: row.log_status || null,
    validation_status: row.validation_status || null,
    department_validation_status:
      row.department_validation_status || null,
    updated_at:
      row.updated_at ||
      row.time_out_at ||
      row.time_in_at ||
      new Date().toISOString(),
    event_type: eventType,
  };

  await emitToStudent(
    io,
    supabase,
    row.student_id,
    eventType === 'INSERT' ? 'ro:log-created' : 'ro:log-updated',
    eventPayload
  );
  await emitToStudent(
    io,
    supabase,
    row.student_id,
    'ro:time-log-updated',
    eventPayload
  );
}

async function handleRoPlacementChange(io, supabase, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;
  const placementId = row.placement_id || row.ro_placement_id || null;
  const studentId = await resolveRoStudentId(supabase, row.ro_id);

  const eventPayload = {
    placement_id: placementId,
    ro_id: row.ro_id || null,
    student_id: studentId || null,
    ro_area_id: row.ro_area_id || null,
    placement_status: row.placement_status || null,
    assignment_status: row.assignment_status || null,
    updated_at:
      row.updated_at || row.assigned_at || new Date().toISOString(),
    event_type: eventType,
    source: 'ro_placement',
  };

  await emitToStudent(
    io,
    supabase,
    studentId,
    'ro:updated',
    eventPayload
  );
  await emitToStudent(
    io,
    supabase,
    studentId,
    'ro:assignment-updated',
    eventPayload
  );
}

function handleRoScholarRequestChange(io, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;

  const eventPayload = {
    request_id: row.request_id || row.ro_request_id || null,
    ro_id: row.ro_id || null,
    student_id: row.student_id || null,
    request_status: row.request_status || row.status || null,
    updated_at: row.updated_at || row.reviewed_at || new Date().toISOString(),
    event_type: eventType,
    source: 'ro_scholar_request',
  };

  emitGlobal(io, 'ro:updated', eventPayload);
  emitGlobal(io, 'ro:progress-updated', eventPayload);
}

function handleRoAreaCoordinatorChange(io, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;

  emitGlobal(io, 'ro:settings-updated', {
    coordinator_assignment_id: row.coordinator_assignment_id || null,
    ro_area_id: row.ro_area_id || null,
    coordinator_user_id: row.user_id || null,
    is_active: row.is_active,
    updated_at: row.updated_at || row.assigned_at || new Date().toISOString(),
    event_type: eventType,
    source: 'ro_area_coordinator',
  });
}

function handleChatRoomChange(io, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;
  const roomId = row.room_id || null;
  if (!roomId) return;

  let eventName = 'room:updated';
  if (eventType === 'INSERT') eventName = 'room:created';
  if (eventType === 'DELETE' || row.is_archived === true) {
    eventName = 'room:archived';
  } else if (old.is_archived === true && row.is_archived === false) {
    eventName = 'room:restored';
  }

  const eventPayload = {
    room_id: roomId,
    roomId,
    room_name: row.room_name || row.name || null,
    roomName: row.room_name || row.name || null,
    is_archived: row.is_archived === true,
    updated_at: row.updated_at || row.created_at || new Date().toISOString(),
    event_type: eventType,
  };

  emitGlobal(io, eventName, eventPayload);
  emitGlobal(io, 'conversation:updated', eventPayload);
}

function handleChatRoomMemberChange(io, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;
  const roomId = row.room_id || null;
  const userId = row.user_id || null;
  if (!roomId) return;

  const eventName = eventType === 'DELETE'
    ? 'room:members-removed'
    : 'room:members-added';
  const eventPayload = {
    room_id: roomId,
    roomId,
    user_id: userId,
    userId,
    is_admin: row.is_admin === true,
    updated_at: row.updated_at || row.joined_at || row.created_at || new Date().toISOString(),
    event_type: eventType,
  };

  if (userId) emitToUser(io, userId, eventName, eventPayload);
  emitGlobal(io, 'conversation:updated', eventPayload);
}

function handleMessageReadStateChange(io, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;
  const userId = row.user_id || null;
  const messageId = row.message_id || null;
  if (!userId || !messageId) return;

  const isRead = eventType === 'DELETE' ? false : row.is_read === true;
  const eventPayload = {
    user_id: userId,
    userId,
    message_id: messageId,
    messageId,
    message_ids: [messageId],
    messageIds: [messageId],
    is_read: isRead,
    isRead,
    updated_at: row.updated_at || row.read_at || new Date().toISOString(),
    event_type: eventType,
  };

  emitToUser(io, userId, isRead ? 'message:read' : 'message:unread', eventPayload);
}

async function handleMessageChange(io, supabase, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;

  if (!row.message_id) return;

  const eventPayload = {
    messageId: row.message_id,
    message_id: row.message_id,
    senderId: row.sender_id || '',
    sender_id: row.sender_id || '',
    receiverId: row.receiver_id || null,
    receiver_id: row.receiver_id || null,
    roomId: row.room_id || null,
    room_id: row.room_id || null,
    subject: row.subject || null,
    messageBody: row.message_body || '',
    message_body: row.message_body || '',
    sentAt: row.sent_at || row.created_at || new Date().toISOString(),
    sent_at: row.sent_at || row.created_at || new Date().toISOString(),
    isRead: row.is_read === true,
    is_read: row.is_read === true,
    attachmentUrl: row.attachment_url || null,
    attachment_url: row.attachment_url || null,
  };

  const targetIds = new Set([row.sender_id, row.receiver_id].filter(Boolean));

  if (row.room_id) {
    const { data, error } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', row.room_id);

    if (error) console.error('[Realtime Bridge] room member lookup failed:', error.message);
    (data || []).forEach((member) => {
      if (member.user_id) targetIds.add(member.user_id);
    });
  }

  const eventName = eventType === 'INSERT'
    ? 'message:new'
    : row.is_read === true
      ? 'message:read'
      : eventType === 'DELETE'
        ? 'message:deleted'
        : 'message:updated';

  targetIds.forEach((userId) => emitToUser(io, userId, eventName, eventPayload));

  if (eventType === 'INSERT') {
    targetIds.forEach((userId) => emitToUser(io, userId, 'message:created', eventPayload));
  }
}

async function handleStudentChange(io, supabase, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;
  const studentId = row.student_id || null;
  const userId = row.user_id || null;

  if (studentId && userId) {
    setCachedRealtimeLookup(`student-user:${studentId}`, userId);
  }

  const basePayload = {
    student_id: studentId,
    user_id: userId,
    userId,
    scholarship_status: row.scholarship_status || null,
    is_active_scholar: row.is_active_scholar === true,
    current_program_id: row.current_program_id || null,
    current_application_id: row.current_application_id || null,
    active_academic_year_id: row.active_academic_year_id || null,
    active_period_id: row.active_period_id || null,
    year_level: row.year_level ?? null,
    course_id: row.course_id || null,
    ro_status: row.ro_status || null,
    ro_progress: row.ro_progress ?? null,
    updated_at: row.updated_at || new Date().toISOString(),
    event_type: eventType,
    source: 'students',
  };

  const profileChanged = rowChanged(
    next,
    old,
    [
      'first_name',
      'middle_name',
      'last_name',
      'email_address',
      'phone_number',
      'profile_photo_url',
      'course_id',
      'year_level',
      'learners_reference_number',
    ],
    eventType
  );

  const scholarChanged = rowChanged(
    next,
    old,
    [
      'is_active_scholar',
      'scholarship_status',
      'current_program_id',
      'current_application_id',
      'active_academic_year_id',
      'active_period_id',
      'scholar_is_archived',
      'ro_status',
      'ro_progress',
    ],
    eventType
  );

  if (profileChanged) {
    if (userId) emitToUser(io, userId, 'profile:updated', basePayload);
    else {
      await emitToStudent(
        io,
        supabase,
        studentId,
        'profile:updated',
        basePayload
      );
    }
  }

  if (scholarChanged) {
    if (userId) emitToUser(io, userId, 'scholar:updated', basePayload);
    else {
      await emitToStudent(
        io,
        supabase,
        studentId,
        'scholar:updated',
        basePayload
      );
    }
  }
}

async function handleStudentProfileChange(io, supabase, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;

  await emitToStudent(
    io,
    supabase,
    row.student_id,
    'profile:updated',
    {
      student_id: row.student_id || null,
      profile_id: row.profile_id || null,
      updated_at: row.updated_at || new Date().toISOString(),
      event_type: eventType,
      source: 'student_profiles',
    }
  );
}

function handlePayoutBatchChange(io, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;

  emitGlobal(io, 'payout:updated', {
    payout_batch_id: row.payout_batch_id || null,
    program_id: row.program_id || null,
    opening_id: row.opening_id || null,
    academic_year_id: row.academic_year_id || null,
    period_id: row.period_id || null,
    batch_status: row.batch_status || null,
    payout_date: row.payout_date || null,
    updated_at: row.updated_at || new Date().toISOString(),
    event_type: eventType,
    source: 'payout_batch',
  });
}

function handleAcademicReferenceChange(io, payload = {}, source = 'academic') {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;

  emitGlobal(io, 'academic:updated', {
    source,
    academic_year_id: row.academic_year_id || null,
    period_id: row.period_id || null,
    course_id: row.course_id || null,
    is_active: row.is_active,
    updated_at: row.updated_at || new Date().toISOString(),
    event_type: eventType,
  });
}

function handleProgramReferenceChange(io, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;

  emitGlobal(io, 'program:updated', {
    program_id: row.program_id || null,
    visibility_status: row.visibility_status || null,
    is_archived: row.is_archived === true,
    updated_at: row.updated_at || new Date().toISOString(),
    event_type: eventType,
    source: 'scholarship_program',
  });
}

function handleRoSettingsChange(io, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;

  emitGlobal(io, 'ro:settings-updated', {
    setting_id: row.setting_id || null,
    academic_year_id: row.academic_year_id || null,
    period_id: row.period_id || null,
    required_hours: row.required_hours ?? null,
    is_active: row.is_active,
    updated_at: row.updated_at || new Date().toISOString(),
    event_type: eventType,
    source: 'ro_settings',
  });
}

function publishRealtimeBridgeStatus(io, status, error = null) {
  if (!io) return;

  const normalizedStatus = String(status || '').trim().toUpperCase();
  const payload = {
    connected: normalizedStatus === 'SUBSCRIBED',
    status: normalizedStatus || 'UNKNOWN',
    error: error?.message || null,
    updated_at: new Date().toISOString(),
  };

  io.smartPdmRealtimeBridgeStatus = payload;
  io.emit('realtime:bridge-status', payload);
}

function configureRealtimeBridge({ io, supabase }) {
  if (!io) {
    console.warn('[Realtime Bridge] not configured: missing io');
    return null;
  }

  if (!supabase) {
    console.warn('[Realtime Bridge] not configured: missing supabase');
    return null;
  }

  const channelGeneration = ++realtimeChannelGeneration;
  publishRealtimeBridgeStatus(io, 'CONNECTING');

  if (realtimeChannel) {
    try {
      supabase.removeChannel(realtimeChannel);
    } catch (error) {
      console.warn('[Realtime Bridge] failed to remove old channel:', error.message);
    }

    realtimeChannel = null;
  }

  realtimeChannel = supabase
    .channel(`smart-pdm-realtime-bridge-${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'announcements',
      },
      (payload) => handleAnnouncementChange(io, payload)
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
      },
      (payload) => handleNotificationChange(io, payload)
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'program_openings',
      },
      (payload) => handleOpeningChange(io, payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'applications' },
      (payload) => handleApplicationChange(io, supabase, payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'application_documents' },
      (payload) => handleApplicationDocumentChange(io, supabase, payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'application_document_reviews' },
      (payload) => handleApplicationDocumentReviewChange(io, supabase, payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'renewals' },
      (payload) => handleRenewalChange(io, supabase, payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'renewal_documents' },
      (payload) => handleRenewalDocumentChange(io, supabase, payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'payout_batch_students' },
      (payload) => handlePayoutChange(io, supabase, payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'payout_proofs' },
      (payload) => handlePayoutProofChange(io, supabase, payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'endorsement_slips' },
      (payload) => handleEndorsementChange(io, supabase, payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profile_photo_reviews' },
      (payload) => handleProfileChange(io, payload, 'profile_photo_review')
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'return_of_obligations' },
      (payload) => handleRoAssignmentChange(io, supabase, payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ro_time_logs' },
      (payload) => handleRoLogChange(io, supabase, payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ro_placements' },
      (payload) => handleRoPlacementChange(io, supabase, payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ro_scholar_requests' },
      (payload) => handleRoScholarRequestChange(io, payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ro_area_coordinators' },
      (payload) => handleRoAreaCoordinatorChange(io, payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chat_rooms' },
      (payload) => handleChatRoomChange(io, payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chat_room_members' },
      (payload) => handleChatRoomMemberChange(io, payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'message_read_states' },
      (payload) => handleMessageReadStateChange(io, payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages' },
      async (payload) => {
        try {
          await handleMessageChange(io, supabase, payload);
        } catch (error) {
          console.error('[Realtime Bridge] message handler failed:', error.message);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'students' },
      (payload) => {
        void handleStudentChange(io, supabase, payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'student_profiles' },
      (payload) => {
        void handleStudentProfileChange(io, supabase, payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'payout_batches' },
      (payload) => handlePayoutBatchChange(io, payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'academic_years' },
      (payload) =>
        handleAcademicReferenceChange(io, payload, 'academic_years')
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'academic_period' },
      (payload) =>
        handleAcademicReferenceChange(io, payload, 'academic_period')
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'academic_course' },
      (payload) =>
        handleAcademicReferenceChange(io, payload, 'academic_course')
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'scholarship_program' },
      (payload) => handleProgramReferenceChange(io, payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ro_settings' },
      (payload) => handleRoSettingsChange(io, payload)
    )
    .subscribe((status, error) => {
      if (channelGeneration !== realtimeChannelGeneration) return;

      const normalizedStatus = String(status || '')
        .trim()
        .toUpperCase();

      publishRealtimeBridgeStatus(io, normalizedStatus, error);

      if (error) {
        console.error(
          '[Realtime Bridge] subscription error:',
          error
        );

        scheduleRealtimeBridgeRestart({
          io,
          supabase,
          reason:
            error?.message ||
            normalizedStatus ||
            'subscription_error',
        });
        return;
      }

      console.log(
        'Realtime bridge status:',
        normalizedStatus || status
      );

      if (normalizedStatus === 'SUBSCRIBED') {
        clearRealtimeRetry();
        return;
      }

      if (
        normalizedStatus === 'CHANNEL_ERROR' ||
        normalizedStatus === 'TIMED_OUT' ||
        normalizedStatus === 'CLOSED'
      ) {
        scheduleRealtimeBridgeRestart({
          io,
          supabase,
          reason: normalizedStatus,
        });
      }
    });

  return realtimeChannel;
}

module.exports = {
  configureRealtimeBridge,
};
