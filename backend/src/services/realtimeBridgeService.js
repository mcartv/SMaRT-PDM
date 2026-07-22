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

function handleApplicationChange(io, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;
  const applicationId = getRecordId(next, old, ['application_id']);

  if (!applicationId) return;

  const eventPayload = {
    application_id: applicationId,
    student_id: row.student_id || null,
    opening_id: row.opening_id || null,
    application_status: row.application_status || null,
    activation_status: row.activation_status || null,
    updated_at: row.updated_at || row.activated_at || new Date().toISOString(),
    event_type: eventType,
  };

  emitGlobal(io, 'application:updated', eventPayload);

  const previousStatus = normalizeText(old.application_status);
  const nextStatus = normalizeText(next.application_status);
  const activationChanged =
    normalizeText(next.activation_status) === 'activated' &&
    normalizeText(old.activation_status) !== 'activated';

  if ((nextStatus === 'approved' && previousStatus !== 'approved') || activationChanged) {
    emitGlobal(io, 'application:approved', eventPayload);
  } else if (
    ['rejected', 'disqualified', 'declined'].includes(nextStatus) &&
    previousStatus !== nextStatus
  ) {
    emitGlobal(io, 'application:rejected', eventPayload);
  }
}

function handleApplicationDocumentChange(io, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const next = payload.new || {};
  const old = payload.old || {};
  const row = eventType === 'DELETE' ? old : next;
  const applicationId = row.application_id || null;

  if (!applicationId) return;

  const eventPayload = {
    application_id: applicationId,
    document_id: row.document_id || null,
    document_key: row.document_type || null,
    document_name: row.document_type || null,
    document_status: row.review_status || null,
    is_submitted: row.is_submitted === true,
    updated_at: row.updated_at || row.submitted_at || new Date().toISOString(),
    event_type: eventType,
    source: 'application_document',
  };

  emitGlobal(io, 'application-document:uploaded', eventPayload);
  emitGlobal(io, 'application:updated', eventPayload);
}

function handleEndorsementChange(io, payload = {}) {
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
    updated_at: row.updated_at || row.completed_at || new Date().toISOString(),
    event_type: eventType,
  };

  emitGlobal(io, 'endorsement:updated', eventPayload);
  emitGlobal(io, 'application:updated', {
    ...eventPayload,
    source: 'endorsement',
  });
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
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'applications' },
      (payload) => handleApplicationChange(io, payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'application_documents' },
      (payload) => handleApplicationDocumentChange(io, payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'endorsement_slips' },
      (payload) => handleEndorsementChange(io, payload)
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
