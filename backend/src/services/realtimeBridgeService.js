let realtimeChannel = null;

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

  console.log('[Socket Emit]', eventName, payload);
  io.emit(eventName, payload);
}

function emitToUser(io, userId, eventName, payload) {
  if (!io || !userId || !eventName) return;

  console.log('[Socket Emit User]', `user:${userId}`, eventName, payload);
  io.to(`user:${userId}`).emit(eventName, payload);
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

  /*
    Force mobile Office Updates refresh even if the specific event name
    is not enough. Your mobile listens to announcement:refresh.
  */
  emitGlobal(io, 'announcement:refresh', {
    ...eventPayload,
    source_event: eventName,
    sourceEvent: eventName,
  });
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

  /*
    Also force refresh for Office Updates if this notification is tied
    to announcement/opening.
  */
  const referenceType = normalizeText(eventPayload.reference_type);

  if (
    referenceType === 'announcement' ||
    referenceType === 'opening' ||
    referenceType === 'program_opening'
  ) {
    if (userId) {
      emitToUser(io, userId, 'announcement:refresh', {
        reference_id: eventPayload.reference_id,
        referenceId: eventPayload.referenceId,
        reference_type: eventPayload.reference_type,
        referenceType: eventPayload.referenceType,
        source_event: eventName,
        sourceEvent: eventName,
      });
    } else {
      emitGlobal(io, 'announcement:refresh', {
        reference_id: eventPayload.reference_id,
        referenceId: eventPayload.referenceId,
        reference_type: eventPayload.reference_type,
        referenceType: eventPayload.referenceType,
        source_event: eventName,
        sourceEvent: eventName,
      });
    }
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

function configureRealtimeBridge({ io, supabase }) {
  if (!io) {
    console.warn('[Realtime Bridge] not configured: missing io');
    return null;
  }

  if (!supabase) {
    console.warn('[Realtime Bridge] not configured: missing supabase');
    return null;
  }

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
    .subscribe((status, error) => {
      if (error) {
        console.error('[Realtime Bridge] subscription error:', error);
        return;
      }

      console.log('Realtime bridge status:', status);
    });

  return realtimeChannel;
}

module.exports = {
  configureRealtimeBridge,
};