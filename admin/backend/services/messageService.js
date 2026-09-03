const db = require('../config/db');
const { resolveAvatarUrl } = require('./avatarService');
const { resolveStaffRole } = require('../utils/staffRoles');

let adminProfilePhotoColumnPromise = null;

async function hasAdminProfilePhotoColumn() {
  if (!adminProfilePhotoColumnPromise) {
    adminProfilePhotoColumnPromise = db.query(
      `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'admin_profiles'
        AND column_name = 'profile_photo_url'
      LIMIT 1;
      `
    )
      .then((result) => result.rows.length > 0)
      .catch((error) => {
        adminProfilePhotoColumnPromise = null;
        console.warn('[Messaging] Unable to inspect admin profile photo column:', error.message);
        return false;
      });
  }

  return adminProfilePhotoColumnPromise;
}

async function getUserSummary(userId) {
  const adminPhotoEnabled = await hasAdminProfilePhotoColumn();
  const adminPhotoExpression = adminPhotoEnabled
    ? 'ap.profile_photo_url'
    : 'NULL::text';

  const result = await db.query(
    `
    SELECT
      u.user_id,
      u.role,
      u.email,
      u.username,
      st.student_id,
      ap.department,
      ap.position,
      roa.ro_area,
      COALESCE(
        st.pdm_id,
        roa.ro_area,
        ap.department,
        INITCAP(REPLACE(COALESCE(u.role, 'user'), '_', ' '))
      ) AS student_number,
      COALESCE(st.profile_photo_url, ${adminPhotoExpression}) AS profile_photo_url,
      CASE
        WHEN st.student_id IS NOT NULL THEN COALESCE(st.is_archived, false)
        WHEN ap.admin_id IS NOT NULL THEN COALESCE(ap.is_archived, false)
        ELSE false
      END AS is_disabled,
      COALESCE(
        NULLIF(TRIM(COALESCE(st.first_name, '') || ' ' || COALESCE(st.last_name, '')), ''),
        NULLIF(TRIM(COALESCE(ap.first_name, '') || ' ' || COALESCE(ap.last_name, '')), ''),
        NULLIF(TRIM(COALESCE(u.username, '')), ''),
        NULLIF(TRIM(COALESCE(u.email, '')), ''),
        'Unknown User'
      ) AS display_name
    FROM users u
    LEFT JOIN students st
      ON st.user_id = u.user_id
    LEFT JOIN admin_profiles ap
      ON ap.user_id = u.user_id
    LEFT JOIN LATERAL (
      SELECT STRING_AGG(DISTINCT rd.department_name, ', ' ORDER BY rd.department_name) AS ro_area
      FROM ro_area_coordinators rac
      JOIN ro_departments rd
        ON rd.department_id = rac.ro_area_id
      WHERE rac.user_id = u.user_id
        AND rac.is_active = true
        AND rd.is_active = true
    ) roa ON true
    WHERE u.user_id = $1
    LIMIT 1;
    `,
    [userId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const resolvedRole = row.student_id
    ? row.role
    : resolveStaffRole({
        user_role: row.role,
        position: row.position,
        department: row.department,
      });

  return {
    ...row,
    role: resolvedRole,
    student_number: row.student_id
      ? row.student_number
      : row.ro_area || (
          resolvedRole === 'ro_coordinator'
            ? row.position || 'RO Coordinator'
            : row.department || row.position || resolvedRole
        ),
    department: resolvedRole === 'ro_coordinator' ? null : row.department,
    is_disabled: row.is_disabled === true,
    profile_photo_url: row.profile_photo_url || null,
    avatar_url: await resolveAvatarUrl(row.profile_photo_url),
  };
}

async function getUserSummarySafe(userId) {
  try {
    return await getUserSummary(userId);
  } catch (error) {
    console.warn('[Messaging] Profile enrichment failed for room member:', {
      userId,
      message: error.message,
    });

    try {
      const fallback = await db.query(
        `
        SELECT user_id, role, email, username
        FROM users
        WHERE user_id = $1
        LIMIT 1;
        `,
        [userId]
      );
      const row = fallback.rows[0];
      if (!row) return null;
      return {
        ...row,
        display_name: row.username || row.email || 'Unknown User',
        student_number: null,
        profile_photo_url: null,
        avatar_url: null,
        department: null,
        position: null,
        is_disabled: false,
      };
    } catch (fallbackError) {
      console.warn('[Messaging] Basic user fallback failed:', fallbackError.message);
      return null;
    }
  }
}

async function ensureRoomMembership(userId, roomId) {
  const result = await db.query(
    `
    SELECT room_id, user_id, is_admin
    FROM chat_room_members
    WHERE room_id = $1
      AND user_id = $2
    LIMIT 1;
    `,
    [roomId, userId]
  );

  if (!result.rows.length) {
    const error = new Error('You are not a member of this chat room');
    error.statusCode = 403;
    throw error;
  }

  return result.rows[0];
}

async function ensureRoomAdmin(userId, roomId) {
  const membership = await ensureRoomMembership(userId, roomId);

  if (membership.is_admin !== true) {
    const error = new Error('Only a group admin can manage members.');
    error.statusCode = 403;
    throw error;
  }

  return membership;
}

async function createPrivateReadStates(messageId, senderId, receiverId) {
  await db.query(
    `
    INSERT INTO message_read_states (
      message_id,
      user_id,
      is_read
    )
    VALUES
      ($1, $2, true),
      ($1, $3, false)
    ON CONFLICT (message_id, user_id)
    DO UPDATE SET
      is_read = EXCLUDED.is_read,
      updated_at = now();
    `,
    [messageId, senderId, receiverId]
  );
}

async function createRoomReadStates(messageId, roomId, senderId) {
  await db.query(
    `
    INSERT INTO message_read_states (
      message_id,
      user_id,
      is_read
    )
    SELECT
      $1,
      crm.user_id,
      CASE WHEN crm.user_id = $3 THEN true ELSE false END
    FROM chat_room_members crm
    WHERE crm.room_id = $2
    ON CONFLICT (message_id, user_id)
    DO UPDATE SET
      is_read = EXCLUDED.is_read,
      updated_at = now();
    `,
    [messageId, roomId, senderId]
  );
}

async function enrichMessageRows(rows = []) {
  const userIds = [
    ...new Set(
      rows
        .flatMap((row) => [row.sender_id, row.reply_sender_id])
        .filter(Boolean)
    ),
  ];
  const summaries = new Map();

  for (const userId of userIds) {
    summaries.set(userId, await getUserSummarySafe(userId));
  }

  return rows.map((row) => ({
    ...row,
    sender_name: summaries.get(row.sender_id)?.display_name || 'Unknown User',
    sender_profile_photo_url: summaries.get(row.sender_id)?.profile_photo_url || null,
    sender_avatar_url: summaries.get(row.sender_id)?.avatar_url || null,
    reply_sender_name: row.reply_sender_id
      ? summaries.get(row.reply_sender_id)?.display_name || 'Unknown User'
      : null,
  }));
}

async function enrichRoomMessageReadReceipts(rows = []) {
  const readerIds = [
    ...new Set(
      rows
        .flatMap((row) => (Array.isArray(row.seen_by) ? row.seen_by : []))
        .map((receipt) => receipt?.user_id)
        .filter(Boolean)
    ),
  ];
  const summaries = new Map();

  await Promise.all(
    readerIds.map(async (userId) => {
      summaries.set(userId, await getUserSummarySafe(userId));
    })
  );

  return rows.map((row) => ({
    ...row,
    seen_by: (Array.isArray(row.seen_by) ? row.seen_by : []).map((receipt) => {
      const summary = summaries.get(receipt.user_id);
      return {
        user_id: receipt.user_id,
        name: summary?.display_name || summary?.email || 'Unknown User',
        avatar_url: summary?.avatar_url || null,
        seen_at: receipt.seen_at || null,
      };
    }),
  }));
}

async function ensurePrivateReplyTarget(replyToMessageId, leftUserId, rightUserId) {
  if (!replyToMessageId) return null;

  const result = await db.query(
    `
    SELECT message_id
    FROM messages
    WHERE message_id = $1
      AND room_id IS NULL
      AND (
        (sender_id = $2 AND receiver_id = $3)
        OR
        (sender_id = $3 AND receiver_id = $2)
      )
    LIMIT 1;
    `,
    [replyToMessageId, leftUserId, rightUserId]
  );

  if (!result.rows.length) {
    const error = new Error('The replied message does not belong to this conversation.');
    error.statusCode = 400;
    error.code = 'INVALID_REPLY_TARGET';
    throw error;
  }

  return replyToMessageId;
}

async function ensureRoomReplyTarget(replyToMessageId, roomId) {
  if (!replyToMessageId) return null;

  const result = await db.query(
    `
    SELECT message_id
    FROM messages
    WHERE message_id = $1
      AND room_id = $2
    LIMIT 1;
    `,
    [replyToMessageId, roomId]
  );

  if (!result.rows.length) {
    const error = new Error('The replied message does not belong to this group.');
    error.statusCode = 400;
    error.code = 'INVALID_REPLY_TARGET';
    throw error;
  }

  return replyToMessageId;
}

async function fetchMessageWithReply(messageId, viewerId = null, counterpartyId = null) {
  const result = await db.query(
    `
    SELECT
      m.message_id,
      m.sender_id,
      m.receiver_id,
      m.room_id,
      m.subject,
      m.message_body,
      m.sent_at,
      m.edited_at,
      (SELECT COUNT(*)::int FROM message_edit_history meh WHERE meh.message_id = m.message_id) AS edit_count,
      m.is_read,
      m.attachment_url,
      m.reply_to_message_id,
      m.client_message_id,
      reply.message_body AS reply_message_body,
      reply.sender_id AS reply_sender_id,
      CASE
        WHEN $2::uuid IS NOT NULL
          AND $3::uuid IS NOT NULL
          AND m.sender_id = $2
        THEN COALESCE(counterparty_read.is_read, m.is_read, false)
        ELSE false
      END AS seen_by_counterparty
    FROM messages m
    LEFT JOIN messages reply
      ON reply.message_id = m.reply_to_message_id
     AND NOT EXISTS (
       SELECT 1
       FROM message_hidden_states hidden_reply
       WHERE hidden_reply.message_id = reply.message_id
         AND hidden_reply.user_id = $2
     )
    LEFT JOIN message_read_states counterparty_read
      ON counterparty_read.message_id = m.message_id
     AND counterparty_read.user_id = $3
    WHERE m.message_id = $1
    LIMIT 1;
    `,
    [messageId, viewerId, counterpartyId]
  );

  const enriched = await enrichMessageRows(result.rows);
  return enriched[0] || null;
}

exports.fetchRoomMemberUserIds = async (roomId) => {
  const result = await db.query(
    `
    SELECT user_id
    FROM chat_room_members
    WHERE room_id = $1;
    `,
    [roomId]
  );

  return result.rows.map((row) => row.user_id);
};

exports.fetchConversations = async (currentUserId) => {
  const result = await db.query(
    `
    WITH base AS (
      SELECT
        CASE
          WHEN m.sender_id = $1 THEN m.receiver_id
          ELSE m.sender_id
        END AS counterparty_id,
        m.message_id,
        m.sender_id,
        m.receiver_id,
        m.subject,
        m.message_body,
        m.attachment_url,
        m.sent_at,
        CASE
          WHEN m.sender_id = $1 THEN true
          ELSE COALESCE(mrs.is_read, m.is_read, false)
        END AS viewer_is_read
      FROM messages m
      LEFT JOIN message_read_states mrs
        ON mrs.message_id = m.message_id
       AND mrs.user_id = $1
      WHERE (m.sender_id = $1 OR m.receiver_id = $1)
        AND m.room_id IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM message_hidden_states mhs
          WHERE mhs.message_id = m.message_id
            AND mhs.user_id = $1
        )
        AND NOT EXISTS (
          SELECT 1
          FROM message_thread_archives mta
          WHERE mta.user_id = $1
            AND mta.thread_type = 'private'
            AND mta.counterparty_id = CASE
              WHEN m.sender_id = $1 THEN m.receiver_id
              ELSE m.sender_id
            END
        )
    ),
    latest AS (
      SELECT DISTINCT ON (counterparty_id)
        counterparty_id,
        message_id,
        sender_id,
        subject,
        message_body,
        attachment_url,
        sent_at
      FROM base
      ORDER BY counterparty_id, sent_at DESC, message_id DESC
    ),
    unread AS (
      SELECT
        counterparty_id,
        COUNT(*)::int AS unread_count
      FROM base
      WHERE receiver_id = $1
        AND COALESCE(viewer_is_read, false) = false
      GROUP BY counterparty_id
    )
    SELECT
      l.counterparty_id,
      l.message_id,
      l.sender_id,
      l.subject,
      l.message_body,
      l.attachment_url,
      l.sent_at,
      COALESCE(u.unread_count, 0) AS unread_count
    FROM latest l
    LEFT JOIN unread u
      ON u.counterparty_id = l.counterparty_id
    ORDER BY l.sent_at DESC, l.message_id DESC;
    `,
    [currentUserId]
  );

  const conversations = [];

  for (const row of result.rows) {
    const summary = await getUserSummarySafe(row.counterparty_id);

    conversations.push({
      counterparty_id: row.counterparty_id,
      name: summary?.display_name || 'Unknown User',
      student_number: summary?.student_number || '',
      profile_photo_url: summary?.profile_photo_url || null,
      avatar_url: summary?.avatar_url || null,
      role: summary?.role || '',
      email: summary?.email || '',
      is_disabled: summary?.is_disabled === true,
      last_message: row.message_body || '',
      last_sender_id: row.sender_id || null,
      last_sender_name: row.sender_id === currentUserId ? 'You' : summary?.display_name || 'Unknown User',
      last_attachment_url: row.attachment_url || null,
      subject: row.subject || '',
      last_sent_at: row.sent_at,
      unread_count: Number(row.unread_count || 0),
      conversation_type: 'private',
    });
  }

  return conversations;
};

exports.fetchConversationMessages = async (currentUserId, counterpartyId) => {
  const result = await db.query(
    `
    SELECT
      m.message_id,
      m.sender_id,
      m.receiver_id,
      m.subject,
      m.message_body,
      m.sent_at,
      m.edited_at,
      (SELECT COUNT(*)::int FROM message_edit_history meh WHERE meh.message_id = m.message_id) AS edit_count,
      CASE
        WHEN m.sender_id = $1 THEN true
        ELSE COALESCE(mrs.is_read, m.is_read, false)
      END AS is_read,
      CASE
        WHEN m.sender_id = $1
        THEN COALESCE(counterparty_read.is_read, m.is_read, false)
        ELSE false
      END AS seen_by_counterparty,
      m.attachment_url,
      m.reply_to_message_id,
      m.client_message_id,
      reply.message_body AS reply_message_body,
      reply.sender_id AS reply_sender_id
    FROM messages m
    LEFT JOIN message_read_states mrs
      ON mrs.message_id = m.message_id
     AND mrs.user_id = $1
    LEFT JOIN message_read_states counterparty_read
      ON counterparty_read.message_id = m.message_id
     AND counterparty_read.user_id = $2
    LEFT JOIN messages reply
      ON reply.message_id = m.reply_to_message_id
     AND NOT EXISTS (
       SELECT 1
       FROM message_hidden_states hidden_reply
       WHERE hidden_reply.message_id = reply.message_id
         AND hidden_reply.user_id = $1
     )
    WHERE m.room_id IS NULL
      AND (
        (m.sender_id = $1 AND m.receiver_id = $2)
        OR
        (m.sender_id = $2 AND m.receiver_id = $1)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM message_hidden_states mhs
        WHERE mhs.message_id = m.message_id
          AND mhs.user_id = $1
      )
    ORDER BY m.sent_at ASC, m.message_id ASC;
    `,
    [currentUserId, counterpartyId]
  );

  return enrichMessageRows(result.rows);
};

exports.markConversationRead = async (currentUserId, counterpartyId) => {
  const targetResult = await db.query(
    `
    SELECT m.message_id
    FROM messages m
    LEFT JOIN message_read_states mrs
      ON mrs.message_id = m.message_id
     AND mrs.user_id = $1
    WHERE m.room_id IS NULL
      AND m.receiver_id = $1
      AND m.sender_id = $2
      AND COALESCE(mrs.is_read, m.is_read, false) = false;
    `,
    [currentUserId, counterpartyId]
  );

  const messageIds = targetResult.rows.map((row) => row.message_id);

  if (!messageIds.length) {
    return [];
  }

  await db.query(
    `
    INSERT INTO message_read_states (
      message_id,
      user_id,
      is_read
    )
    SELECT
      unnest($1::uuid[]),
      $2::uuid,
      true
    ON CONFLICT (message_id, user_id)
    DO UPDATE SET
      is_read = true,
      updated_at = now();
    `,
    [messageIds, currentUserId]
  );

  await db.query(
    `
    UPDATE messages
    SET is_read = true
    WHERE message_id = ANY($1::uuid[]);
    `,
    [messageIds]
  );

  return messageIds;
};

exports.markConversationUnread = async (currentUserId, counterpartyId) => {
  const targetResult = await db.query(
    `
    SELECT message_id
    FROM messages
    WHERE room_id IS NULL
      AND receiver_id = $1
      AND sender_id = $2
    ORDER BY sent_at DESC, message_id DESC
    LIMIT 1;
    `,
    [currentUserId, counterpartyId]
  );

  const messageIds = targetResult.rows.map((row) => row.message_id);

  if (!messageIds.length) {
    return [];
  }

  await db.query(
    `
    INSERT INTO message_read_states (
      message_id,
      user_id,
      is_read
    )
    VALUES ($1, $2, false)
    ON CONFLICT (message_id, user_id)
    DO UPDATE SET
      is_read = false,
      updated_at = now();
    `,
    [messageIds[0], currentUserId]
  );

  await db.query(
    `
    UPDATE messages
    SET is_read = false
    WHERE message_id = $1;
    `,
    [messageIds[0]]
  );

  return messageIds;
};

exports.sendMessage = async ({
  senderId,
  receiverId,
  subject = null,
  messageBody,
  attachmentUrl = null,
  replyToMessageId = null,
  clientMessageId = null,
}) => {
  await ensurePrivateReplyTarget(replyToMessageId, senderId, receiverId);

  const result = await db.query(
    `
    INSERT INTO messages (
      sender_id,
      receiver_id,
      room_id,
      subject,
      message_body,
      attachment_url,
      reply_to_message_id,
      client_message_id
    )
    SELECT $1, $2, NULL, $3, $4, $5, $6, $7
    WHERE EXISTS (
      SELECT 1
      FROM users recipient
      LEFT JOIN students st
        ON st.user_id = recipient.user_id
      LEFT JOIN admin_profiles ap
        ON ap.user_id = recipient.user_id
      WHERE recipient.user_id = $2
        AND COALESCE(st.is_archived, false) = false
        AND COALESCE(ap.is_archived, false) = false
    )
    ON CONFLICT (sender_id, client_message_id)
      WHERE client_message_id IS NOT NULL
    DO NOTHING
    RETURNING message_id;
    `,
    [senderId, receiverId, subject, messageBody, attachmentUrl, replyToMessageId, clientMessageId]
  );

  let messageId = result.rows[0]?.message_id || null;
  let deduplicated = false;

  if (!messageId && clientMessageId) {
    const existing = await db.query(
      `
      SELECT message_id, receiver_id, room_id
      FROM messages
      WHERE sender_id = $1
        AND client_message_id = $2
      LIMIT 1;
      `,
      [senderId, clientMessageId]
    );
    const existingMessage = existing.rows[0] || null;
    if (existingMessage && (existingMessage.room_id || existingMessage.receiver_id !== receiverId)) {
      const error = new Error('The message retry key belongs to a different conversation.');
      error.statusCode = 409;
      error.code = 'CLIENT_MESSAGE_ID_CONFLICT';
      throw error;
    }
    messageId = existingMessage?.message_id || null;
    deduplicated = Boolean(messageId);
  }

  if (!messageId) {
    const receiverSummary = await getUserSummarySafe(receiverId);
    const error = new Error(
      receiverSummary?.is_disabled
        ? 'This account is currently disabled. You can view previous messages, but you cannot send new messages to this account.'
        : 'The selected message recipient is no longer available.'
    );
    error.statusCode = receiverSummary?.is_disabled ? 409 : 404;
    error.code = receiverSummary?.is_disabled
      ? 'RECIPIENT_ACCOUNT_DISABLED'
      : 'RECIPIENT_NOT_FOUND';
    throw error;
  }

  if (!deduplicated) {
    await createPrivateReadStates(messageId, senderId, receiverId);
  }

  const restoredArchives = deduplicated
    ? { rows: [] }
    : await db.query(
      `
      DELETE FROM message_thread_archives
      WHERE thread_type = 'private'
        AND (
          (user_id = $1 AND counterparty_id = $2)
          OR
          (user_id = $2 AND counterparty_id = $1)
        )
      RETURNING user_id;
      `,
      [senderId, receiverId]
    );

  const message = await fetchMessageWithReply(messageId, senderId, receiverId);

  return {
    ...message,
    restored_archive_user_ids: restoredArchives.rows
      .map((row) => row.user_id)
      .filter(Boolean),
    is_read: true,
    deduplicated,
  };
};

exports.fetchRooms = async (currentUserId) => {
  const result = await db.query(
    `
    WITH latest_room_message AS (
      SELECT DISTINCT ON (m.room_id)
        m.room_id,
        m.message_id,
        m.sender_id,
        m.subject,
        m.message_body,
        m.attachment_url,
        m.sent_at
      FROM messages m
      WHERE m.room_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM message_hidden_states mhs
          WHERE mhs.message_id = m.message_id
            AND mhs.user_id = $1
        )
      ORDER BY m.room_id, m.sent_at DESC, m.message_id DESC
    ),
    member_counts AS (
      SELECT
        crm.room_id,
        COUNT(*)::int AS member_count
      FROM chat_room_members crm
      GROUP BY crm.room_id
    ),
    unread_counts AS (
      SELECT
        m.room_id,
        COUNT(*)::int AS unread_count
      FROM messages m
      LEFT JOIN message_read_states mrs
        ON mrs.message_id = m.message_id
       AND mrs.user_id = $1
      WHERE m.room_id IS NOT NULL
        AND m.sender_id <> $1
        AND COALESCE(mrs.is_read, false) = false
        AND NOT EXISTS (
          SELECT 1
          FROM message_hidden_states mhs
          WHERE mhs.message_id = m.message_id
            AND mhs.user_id = $1
        )
      GROUP BY m.room_id
    )
    SELECT
      cr.room_id,
      cr.room_name,
      cr.created_by,
      cr.created_at,
      COALESCE(lrm.message_body, '') AS last_message,
      lrm.sender_id AS last_sender_id,
      lrm.attachment_url AS last_attachment_url,
      lrm.subject,
      lrm.sent_at AS last_sent_at,
      COALESCE(mc.member_count, 0) AS member_count,
      COALESCE(uc.unread_count, 0) AS unread_count,
      COALESCE(my_membership.is_admin, false) AS is_admin
    FROM chat_room_members my_membership
    JOIN chat_rooms cr
      ON cr.room_id = my_membership.room_id
    LEFT JOIN latest_room_message lrm
      ON lrm.room_id = cr.room_id
    LEFT JOIN member_counts mc
      ON mc.room_id = cr.room_id
    LEFT JOIN unread_counts uc
      ON uc.room_id = cr.room_id
    WHERE my_membership.user_id = $1
      AND COALESCE(cr.is_archived, false) = false
      AND NOT EXISTS (
        SELECT 1
        FROM message_thread_archives mta
        WHERE mta.user_id = $1
          AND mta.thread_type = 'group'
          AND mta.room_id = cr.room_id
      )
    ORDER BY lrm.sent_at DESC NULLS LAST, cr.created_at DESC;
    `,
    [currentUserId]
  );

  const rooms = [];
  for (const row of result.rows) {
    const senderSummary = row.last_sender_id
      ? await getUserSummarySafe(row.last_sender_id)
      : null;

    rooms.push({
      room_id: row.room_id,
      room_name: row.room_name || 'Untitled Group',
      created_by: row.created_by,
      created_at: row.created_at,
      last_message: row.last_message || '',
      last_sender_id: row.last_sender_id || null,
      last_sender_name:
        row.last_sender_id === currentUserId
          ? 'You'
          : senderSummary?.display_name || '',
      last_attachment_url: row.last_attachment_url || null,
      subject: row.subject || '',
      last_sent_at: row.last_sent_at,
      member_count: Number(row.member_count || 0),
      unread_count: Number(row.unread_count || 0),
      is_admin: row.is_admin === true,
      conversation_type: 'group',
    });
  }

  return rooms;
};

exports.createRoom = async ({ creatorId, roomName = null, memberIds = [] }) => {
  const normalizedCreatorId = String(creatorId || '').trim();
  const normalizedMemberIds = memberIds
    .map((memberId) => String(memberId || '').trim())
    .filter(Boolean);

  const uniqueMemberIds = [
    ...new Set(normalizedMemberIds.filter((userId) => userId !== normalizedCreatorId)),
  ];

  if (!normalizedCreatorId) {
    throw new Error('A valid room creator is required.');
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const roomResult = await client.query(
      `
      INSERT INTO chat_rooms (
        room_name,
        created_by
      )
      VALUES ($1, $2)
      RETURNING room_id, room_name, created_by, created_at, is_archived;
      `,
      [roomName || 'New Group Chat', normalizedCreatorId]
    );

    const room = roomResult.rows[0];

    await client.query(
      `
      INSERT INTO chat_room_members (
        room_id,
        user_id,
        is_admin
      )
      VALUES ($1, $2, true)
      ON CONFLICT (room_id, user_id)
      DO UPDATE SET is_admin = true;
      `,
      [room.room_id, normalizedCreatorId]
    );

    for (const userId of uniqueMemberIds) {
      await client.query(
        `
        INSERT INTO chat_room_members (
          room_id,
          user_id,
          is_admin
        )
        VALUES ($1, $2, false)
        ON CONFLICT (room_id, user_id)
        DO NOTHING;
        `,
        [room.room_id, userId]
      );
    }

    await client.query('COMMIT');

    return {
      ...room,
      member_ids: [normalizedCreatorId, ...uniqueMemberIds],
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.fetchRoomMessages = async (currentUserId, roomId) => {
  await ensureRoomMembership(currentUserId, roomId);

  const result = await db.query(
    `
    SELECT
      m.message_id,
      m.sender_id,
      m.receiver_id,
      m.room_id,
      m.subject,
      m.message_body,
      m.sent_at,
      m.edited_at,
      (SELECT COUNT(*)::int FROM message_edit_history meh WHERE meh.message_id = m.message_id) AS edit_count,
      COALESCE(mrs.is_read, CASE WHEN m.sender_id = $2 THEN true ELSE false END) AS is_read,
      false AS seen_by_counterparty,
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'user_id', reader.user_id,
              'seen_at', reader.updated_at
            )
            ORDER BY reader.updated_at DESC
          )
          FROM message_read_states reader
          WHERE reader.message_id = m.message_id
            AND reader.is_read = true
            AND reader.user_id <> m.sender_id
        ),
        '[]'::jsonb
      ) AS seen_by,
      m.attachment_url,
      m.reply_to_message_id,
      m.client_message_id,
      reply.message_body AS reply_message_body,
      reply.sender_id AS reply_sender_id
    FROM messages m
    LEFT JOIN message_read_states mrs
      ON mrs.message_id = m.message_id
     AND mrs.user_id = $2
    LEFT JOIN messages reply
      ON reply.message_id = m.reply_to_message_id
     AND NOT EXISTS (
       SELECT 1
       FROM message_hidden_states hidden_reply
       WHERE hidden_reply.message_id = reply.message_id
         AND hidden_reply.user_id = $2
     )
    WHERE m.room_id = $1
      AND NOT EXISTS (
        SELECT 1
        FROM message_hidden_states mhs
        WHERE mhs.message_id = m.message_id
          AND mhs.user_id = $2
      )
    ORDER BY m.sent_at ASC, m.message_id ASC;
    `,
    [roomId, currentUserId]
  );

  const enrichedRows = await enrichMessageRows(result.rows);
  return enrichRoomMessageReadReceipts(enrichedRows);
};

exports.sendRoomMessage = async ({
  senderId,
  roomId,
  subject = null,
  messageBody,
  attachmentUrl = null,
  replyToMessageId = null,
  clientMessageId = null,
}) => {
  await ensureRoomMembership(senderId, roomId);
  await ensureRoomReplyTarget(replyToMessageId, roomId);

  const result = await db.query(
    `
    INSERT INTO messages (
      sender_id,
      receiver_id,
      room_id,
      subject,
      message_body,
      attachment_url,
      reply_to_message_id,
      client_message_id
    )
    VALUES ($1, NULL, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (sender_id, client_message_id)
      WHERE client_message_id IS NOT NULL
    DO NOTHING
    RETURNING message_id;
    `,
    [senderId, roomId, subject, messageBody, attachmentUrl, replyToMessageId, clientMessageId]
  );

  let messageId = result.rows[0]?.message_id || null;
  let deduplicated = false;

  if (!messageId && clientMessageId) {
    const existing = await db.query(
      `
      SELECT message_id, receiver_id, room_id
      FROM messages
      WHERE sender_id = $1
        AND client_message_id = $2
      LIMIT 1;
      `,
      [senderId, clientMessageId]
    );
    const existingMessage = existing.rows[0] || null;
    if (existingMessage && existingMessage.room_id !== roomId) {
      const error = new Error('The message retry key belongs to a different group.');
      error.statusCode = 409;
      error.code = 'CLIENT_MESSAGE_ID_CONFLICT';
      throw error;
    }
    messageId = existingMessage?.message_id || null;
    deduplicated = Boolean(messageId);
  }

  if (!messageId) {
    const error = new Error('Unable to send the group message.');
    error.statusCode = 400;
    error.code = 'GROUP_MESSAGE_SEND_FAILED';
    throw error;
  }

  if (!deduplicated) {
    await createRoomReadStates(messageId, roomId, senderId);
  }

  const restoredArchives = deduplicated
    ? { rows: [] }
    : await db.query(
      `
      DELETE FROM message_thread_archives mta
      WHERE mta.thread_type = 'group'
        AND mta.room_id = $1
        AND EXISTS (
          SELECT 1
          FROM chat_room_members crm
          WHERE crm.room_id = mta.room_id
            AND crm.user_id = mta.user_id
        )
      RETURNING mta.user_id;
      `,
      [roomId]
    );

  const message = await fetchMessageWithReply(messageId, senderId, null);

  return {
    ...message,
    restored_archive_user_ids: restoredArchives.rows
      .map((row) => row.user_id)
      .filter(Boolean),
    is_read: true,
    deduplicated,
  };
};

async function createRoomSystemMessage({ roomId, senderId, body }) {
  const result = await db.query(
    `INSERT INTO messages (sender_id, receiver_id, room_id, subject, message_body, is_read)
     VALUES ($1, NULL, $2, 'system', $3, true)
     RETURNING message_id, sender_id, receiver_id, room_id, subject, message_body, sent_at, is_read;`,
    [senderId, roomId, body]
  );
  const message = await fetchMessageWithReply(result.rows[0].message_id, senderId, null);
  return message;
}

exports.addRoomMembers = async ({ actorId, roomId, memberIds = [] }) => {
  await ensureRoomAdmin(actorId, roomId);

  const uniqueMemberIds = [...new Set(memberIds.filter(Boolean))];
  const inserted = [];

  for (const userId of uniqueMemberIds) {
    const result = await db.query(
      `
      INSERT INTO chat_room_members (
        room_id,
        user_id,
        is_admin
      )
      VALUES ($1, $2, false)
      ON CONFLICT DO NOTHING
      RETURNING room_id, user_id, is_admin;
      `,
      [roomId, userId]
    );

    if (result.rows[0]) {
      inserted.push(result.rows[0]);
    }
  }

  if (inserted.length) {
    const actor = await getUserSummarySafe(actorId);
    for (const member of inserted) {
      const target = await getUserSummarySafe(member.user_id);
      await createRoomSystemMessage({
        roomId,
        senderId: actorId,
        body: `${actor?.display_name || 'Admin'} added ${target?.display_name || 'a new member'}`,
      });
    }
  }

  return {
    room_id: roomId,
    added_count: inserted.length,
    members: inserted,
  };
};

exports.fetchRoomMembers = async (currentUserId, roomId) => {
  const viewerMembership = await ensureRoomMembership(currentUserId, roomId);
  const result = await db.query(
    `
    SELECT room_id, user_id, is_admin
    FROM chat_room_members
    WHERE room_id = $1
    ORDER BY is_admin DESC, user_id ASC;
    `,
    [roomId]
  );

  const summaries = await Promise.all(
    result.rows.map((row) => getUserSummarySafe(row.user_id))
  );

  const items = result.rows.map((row, index) => {
    const summary = summaries[index];
    return {
      user_id: row.user_id,
      name: summary?.display_name || summary?.email || 'Unknown User',
      subtitle:
        summary?.student_number ||
        summary?.position ||
        summary?.department ||
        summary?.role ||
        '',
      student_number: summary?.student_number || null,
      role: summary?.role || null,
      email: summary?.email || null,
      department: summary?.department || null,
      ro_area: summary?.ro_area || null,
      position: summary?.position || null,
      profile_photo_url: summary?.profile_photo_url || null,
      avatar_url: summary?.avatar_url || null,
      is_admin: row.is_admin === true,
      is_current_user: row.user_id === currentUserId,
      joined_at: null,
    };
  }).sort((left, right) =>
    String(left.name || '').localeCompare(String(right.name || ''), 'en', {
      sensitivity: 'base',
      numeric: true,
    })
  );

  return {
    room_id: roomId,
    viewer_is_admin: viewerMembership.is_admin === true,
    items,
  };
};

exports.promoteRoomMemberToAdmin = async ({ actorId, roomId, memberId }) => {
  await ensureRoomAdmin(actorId, roomId);
  const normalizedMemberId = String(memberId || '').trim();

  if (!normalizedMemberId) {
    const error = new Error('A valid member is required.');
    error.statusCode = 400;
    throw error;
  }

  const memberResult = await db.query(
    `SELECT is_admin FROM chat_room_members WHERE room_id = $1 AND user_id = $2 LIMIT 1;`,
    [roomId, normalizedMemberId]
  );
  const member = memberResult.rows[0];

  if (!member) {
    const error = new Error('Group member not found.');
    error.statusCode = 404;
    throw error;
  }

  if (member.is_admin === true) {
    return {
      room_id: roomId,
      member_id: normalizedMemberId,
      promoted: false,
      already_admin: true,
    };
  }

  await db.query(
    `UPDATE chat_room_members SET is_admin = true WHERE room_id = $1 AND user_id = $2;`,
    [roomId, normalizedMemberId]
  );

  return {
    room_id: roomId,
    member_id: normalizedMemberId,
    promoted: true,
    already_admin: false,
  };
};

exports.removeRoomMember = async ({ actorId, roomId, memberId }) => {
  await ensureRoomAdmin(actorId, roomId);
  const normalizedMemberId = String(memberId || '').trim();

  if (!normalizedMemberId) {
    const error = new Error('A valid member is required.');
    error.statusCode = 400;
    throw error;
  }

  if (normalizedMemberId === actorId) {
    const error = new Error('Use Leave Group to remove yourself.');
    error.statusCode = 400;
    throw error;
  }

  const memberResult = await db.query(
    `SELECT is_admin FROM chat_room_members WHERE room_id = $1 AND user_id = $2 LIMIT 1;`,
    [roomId, normalizedMemberId]
  );
  const member = memberResult.rows[0];

  if (!member) {
    const error = new Error('Group member not found.');
    error.statusCode = 404;
    throw error;
  }

  if (member.is_admin === true) {
    const error = new Error('Another group admin cannot be removed.');
    error.statusCode = 403;
    throw error;
  }

  const target = await getUserSummarySafe(normalizedMemberId);

  await db.query(
    `DELETE FROM chat_room_members WHERE room_id = $1 AND user_id = $2;`,
    [roomId, normalizedMemberId]
  );

  const actor = await getUserSummarySafe(actorId);
  await createRoomSystemMessage({
    roomId,
    senderId: actorId,
    body: `${actor?.display_name || 'Admin'} removed ${target?.display_name || 'a member'}`,
  });

  return { room_id: roomId, member_id: normalizedMemberId, removed: true };
};

exports.leaveRoom = async (currentUserId, roomId) => {
  await ensureRoomMembership(currentUserId, roomId);
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Serialize membership changes for this room so two admins cannot leave at
    // the same time and accidentally leave the group without an administrator.
    const lockedMembershipsResult = await client.query(
      `
      SELECT user_id, is_admin
      FROM chat_room_members
      WHERE room_id = $1
      ORDER BY user_id ASC
      FOR UPDATE;
      `,
      [roomId]
    );
    const lockedMemberships = lockedMembershipsResult.rows;
    const membership = lockedMemberships.find(
      (row) => String(row.user_id) === String(currentUserId)
    );

    if (!membership) {
      const error = new Error('You are not a member of this chat room');
      error.statusCode = 403;
      throw error;
    }

    if (membership.is_admin === true) {
      const memberCount = lockedMemberships.length;
      const adminCount = lockedMemberships.filter((row) => row.is_admin === true).length;

      if (memberCount > 1 && adminCount <= 1) {
        const error = new Error('Assign another group admin before leaving this group.');
        error.statusCode = 409;
        error.code = 'LAST_GROUP_ADMIN';
        throw error;
      }
    }

    // Leaving a group is personal to this account. Preserve the thread in the
    // current user's archive before removing their membership. Other members
    // remain unaffected and continue seeing the group normally.
    await client.query(
      `
      DELETE FROM message_thread_archives
      WHERE user_id = $1
        AND thread_type = 'group'
        AND room_id = $2;
      `,
      [currentUserId, roomId]
    );

    const archiveResult = await client.query(
      `
      INSERT INTO message_thread_archives (
        user_id,
        thread_type,
        counterparty_id,
        room_id
      )
      VALUES ($1, 'group', NULL, $2)
      RETURNING archive_id, user_id, thread_type, counterparty_id, room_id, archived_at;
      `,
      [currentUserId, roomId]
    );

    await client.query(
      `DELETE FROM chat_room_members WHERE room_id = $1 AND user_id = $2;`,
      [roomId, currentUserId]
    );

    const remainingResult = await client.query(
      `
      SELECT user_id, is_admin
      FROM chat_room_members
      WHERE room_id = $1
      ORDER BY is_admin DESC, user_id ASC;
      `,
      [roomId]
    );

    if (!remainingResult.rows.length) {
      await client.query(
        `UPDATE chat_rooms SET is_archived = true WHERE room_id = $1;`,
        [roomId]
      );
    }

    await client.query('COMMIT');
    const member = await getUserSummarySafe(currentUserId);
    await createRoomSystemMessage({
      roomId,
      senderId: currentUserId,
      body: `${member?.display_name || 'A member'} left the group`,
    });
    return {
      room_id: roomId,
      user_id: currentUserId,
      left: true,
      promoted_user_id: null,
      archive: archiveResult.rows[0] || null,
      archived_at: archiveResult.rows[0]?.archived_at || null,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

exports.markRoomMessagesRead = async (currentUserId, roomId) => {
  await ensureRoomMembership(currentUserId, roomId);

  const targetResult = await db.query(
    `
    SELECT m.message_id
    FROM messages m
    LEFT JOIN message_read_states mrs
      ON mrs.message_id = m.message_id
     AND mrs.user_id = $2
    WHERE m.room_id = $1
      AND m.sender_id <> $2
      AND COALESCE(mrs.is_read, false) = false;
    `,
    [roomId, currentUserId]
  );

  const messageIds = targetResult.rows.map((row) => row.message_id);

  if (!messageIds.length) {
    return [];
  }

  await db.query(
    `
    INSERT INTO message_read_states (
      message_id,
      user_id,
      is_read
    )
    SELECT
      unnest($1::uuid[]),
      $2::uuid,
      true
    ON CONFLICT (message_id, user_id)
    DO UPDATE SET
      is_read = true,
      updated_at = now();
    `,
    [messageIds, currentUserId]
  );

  return messageIds;
};

exports.markRoomMessagesUnread = async (currentUserId, roomId) => {
  await ensureRoomMembership(currentUserId, roomId);

  const targetResult = await db.query(
    `
    SELECT message_id
    FROM messages
    WHERE room_id = $1
      AND sender_id <> $2
    ORDER BY sent_at DESC, message_id DESC
    LIMIT 1;
    `,
    [roomId, currentUserId]
  );

  const messageIds = targetResult.rows.map((row) => row.message_id);

  if (!messageIds.length) {
    return [];
  }

  await db.query(
    `
    INSERT INTO message_read_states (
      message_id,
      user_id,
      is_read
    )
    VALUES ($1, $2, false)
    ON CONFLICT (message_id, user_id)
    DO UPDATE SET
      is_read = false,
      updated_at = now();
    `,
    [messageIds[0], currentUserId]
  );

  return messageIds;
};

exports.archiveConversation = async (currentUserId, counterpartyId) => {
  await db.query(
    `
    DELETE FROM message_thread_archives
    WHERE user_id = $1
      AND thread_type = 'private'
      AND counterparty_id = $2;
    `,
    [currentUserId, counterpartyId]
  );

  const result = await db.query(
    `
    INSERT INTO message_thread_archives (
      user_id,
      thread_type,
      counterparty_id,
      room_id
    )
    VALUES ($1, 'private', $2, NULL)
    RETURNING archive_id, user_id, thread_type, counterparty_id, room_id, archived_at;
    `,
    [currentUserId, counterpartyId]
  );

  return result.rows[0];
};

exports.archiveRoom = async (
  currentUserId,
  roomId,
  { skipMembershipCheck = false } = {}
) => {
  if (!skipMembershipCheck) {
    await ensureRoomMembership(currentUserId, roomId);
  }

  await db.query(
    `
    DELETE FROM message_thread_archives
    WHERE user_id = $1
      AND thread_type = 'group'
      AND room_id = $2;
    `,
    [currentUserId, roomId]
  );

  const result = await db.query(
    `
    INSERT INTO message_thread_archives (
      user_id,
      thread_type,
      counterparty_id,
      room_id
    )
    VALUES ($1, 'group', NULL, $2)
    RETURNING archive_id, user_id, thread_type, counterparty_id, room_id, archived_at;
    `,
    [currentUserId, roomId]
  );

  return result.rows[0];
};

exports.fetchScholarMembers = async () => {
  const result = await db.query(
    `
    SELECT
      u.user_id,
      st.student_id AS scholar_id,
      st.student_id,
      st.pdm_id AS student_number,
      st.first_name,
      st.last_name,
      st.profile_photo_url,
      TRIM(COALESCE(st.first_name, '') || ' ' || COALESCE(st.last_name, '')) AS student_name,
      COALESCE(ac.course_code, 'No Program') AS program_name,
      'Unassigned Benefactor' AS benefactor_name
    FROM students st
    LEFT JOIN users u
      ON st.user_id = u.user_id
    LEFT JOIN academic_course ac
      ON st.course_id = ac.course_id
    WHERE COALESCE(st.is_archived, false) = false
      AND u.user_id IS NOT NULL
    ORDER BY student_name ASC;
    `
  );

  const items = [];

  for (const row of result.rows) {
    items.push({
      ...row,
      avatar_url: await resolveAvatarUrl(row.profile_photo_url),
    });
  }

  return items;
};

exports.fetchArchivedThreads = async (currentUserId) => {
  const privateArchivesResult = await db.query(
    `
    SELECT
      archive_id,
      archived_at,
      counterparty_id
    FROM message_thread_archives
    WHERE user_id = $1
      AND thread_type = 'private'
    ORDER BY archived_at DESC;
    `,
    [currentUserId]
  );

  const groupArchivesResult = await db.query(
    `
    SELECT
      mta.archive_id,
      mta.archived_at,
      cr.room_id,
      cr.room_name,
      cr.created_at,
      COALESCE(last_message.message_body, '') AS last_message,
      last_message.sent_at AS last_sent_at,
      COALESCE(member_count.member_count, 0)::int AS member_count,
      EXISTS (
        SELECT 1
        FROM chat_room_members my_membership
        WHERE my_membership.room_id = cr.room_id
          AND my_membership.user_id = $1
      ) AS can_restore
    FROM message_thread_archives mta
    JOIN chat_rooms cr
      ON cr.room_id = mta.room_id
    LEFT JOIN LATERAL (
      SELECT
        m.message_body,
        m.sent_at
      FROM messages m
      WHERE m.room_id = cr.room_id
      ORDER BY m.sent_at DESC, m.message_id DESC
      LIMIT 1
    ) last_message ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS member_count
      FROM chat_room_members crm
      WHERE crm.room_id = cr.room_id
    ) member_count ON true
    WHERE mta.user_id = $1
      AND mta.thread_type = 'group'
    ORDER BY mta.archived_at DESC;
    `,
    [currentUserId]
  );

  const items = [];

  for (const archive of privateArchivesResult.rows) {
    const summary = await getUserSummarySafe(archive.counterparty_id);

    const lastMessageResult = await db.query(
      `
      SELECT
        message_body,
        sent_at
      FROM messages
      WHERE room_id IS NULL
        AND (
          (sender_id = $1 AND receiver_id = $2)
          OR
          (sender_id = $2 AND receiver_id = $1)
        )
      ORDER BY sent_at DESC, message_id DESC
      LIMIT 1;
      `,
      [currentUserId, archive.counterparty_id]
    );

    const lastMessage = lastMessageResult.rows[0] || {};

    items.push({
      archive_id: archive.archive_id,
      thread_type: 'private',
      counterparty_id: archive.counterparty_id,
      room_id: null,
      name: summary?.display_name || 'Unknown User',
      student_number: summary?.student_number || '',
      is_disabled: summary?.is_disabled === true,
      avatar_url: summary?.avatar_url || null,
      profile_photo_url: summary?.profile_photo_url || null,
      last_message: lastMessage.message_body || '',
      last_sent_at: lastMessage.sent_at || null,
      member_count: null,
      archived_at: archive.archived_at,
    });
  }

  for (const archive of groupArchivesResult.rows) {
    items.push({
      archive_id: archive.archive_id,
      thread_type: 'group',
      counterparty_id: null,
      room_id: archive.room_id,
      name: archive.room_name || 'Untitled Group',
      student_number: `${Number(archive.member_count || 0)} members`,
      avatar_url: null,
      profile_photo_url: null,
      last_message: archive.last_message || '',
      last_sent_at: archive.last_sent_at || archive.created_at || null,
      member_count: Number(archive.member_count || 0),
      can_restore: archive.can_restore === true,
      archived_at: archive.archived_at,
    });
  }

  return items.sort(
    (left, right) =>
      new Date(right.archived_at || 0).getTime() -
      new Date(left.archived_at || 0).getTime()
  );
};

exports.restoreConversation = async (currentUserId, counterpartyId) => {
  const result = await db.query(
    `
    DELETE FROM message_thread_archives
    WHERE user_id = $1
      AND thread_type = 'private'
      AND counterparty_id = $2
    RETURNING archive_id, user_id, thread_type, counterparty_id, room_id, archived_at;
    `,
    [currentUserId, counterpartyId]
  );

  return {
    restored: result.rowCount > 0,
    archive: result.rows[0] || null,
    counterparty_id: counterpartyId,
  };
};

exports.restoreRoom = async (
  currentUserId,
  roomId,
  { skipMembershipCheck = false } = {}
) => {
  if (!skipMembershipCheck) {
    await ensureRoomMembership(currentUserId, roomId);
  }

  const result = await db.query(
    `
    DELETE FROM message_thread_archives
    WHERE user_id = $1
      AND thread_type = 'group'
      AND room_id = $2
    RETURNING archive_id, user_id, thread_type, counterparty_id, room_id, archived_at;
    `,
    [currentUserId, roomId]
  );

  return {
    restored: result.rowCount > 0,
    archive: result.rows[0] || null,
    room_id: roomId,
  };
};

exports.hideMessageForUser = async (currentUserId, messageId) => {
  const result = await db.query(
    `
    SELECT message_id, sender_id, receiver_id, room_id
    FROM messages
    WHERE message_id = $1
    LIMIT 1;
    `,
    [messageId]
  );
  const message = result.rows[0];

  if (!message) {
    const error = new Error('Message not found.');
    error.statusCode = 404;
    throw error;
  }

  if (message.room_id) {
    await ensureRoomMembership(currentUserId, message.room_id);
  } else if (message.sender_id !== currentUserId && message.receiver_id !== currentUserId) {
    const error = new Error('You do not have access to this message.');
    error.statusCode = 403;
    throw error;
  }

  await db.query(
    `
    INSERT INTO message_hidden_states (message_id, user_id)
    VALUES ($1, $2)
    ON CONFLICT (message_id, user_id) DO NOTHING;
    `,
    [messageId, currentUserId]
  );

  return {
    message_id: messageId,
    room_id: message.room_id || null,
    counterparty_id: message.room_id
      ? null
      : (message.sender_id === currentUserId ? message.receiver_id : message.sender_id),
    hidden_by: currentUserId,
  };
};

exports.editMessage = async (currentUserId, messageId, messageBody) => {
  const cleanMessageBody = String(messageBody || '').trim();
  if (!cleanMessageBody) {
    const error = new Error('Message body is required.');
    error.statusCode = 400;
    throw error;
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const currentResult = await client.query(
      `
      SELECT m.*, now() AS database_now
      FROM messages m
      WHERE m.message_id = $1
      FOR UPDATE;
      `,
      [messageId]
    );
    const current = currentResult.rows[0];
    if (!current) {
      const error = new Error('Message not found.');
      error.statusCode = 404;
      throw error;
    }
    if (current.sender_id !== currentUserId) {
      const error = new Error('You can only edit your own messages.');
      error.statusCode = 403;
      throw error;
    }
    if (new Date(current.database_now).getTime() - new Date(current.sent_at).getTime() > 15 * 60 * 1000) {
      const error = new Error('Messages can only be edited within 15 minutes of sending.');
      error.statusCode = 409;
      error.code = 'MESSAGE_EDIT_WINDOW_EXPIRED';
      throw error;
    }
    const editCountResult = await client.query(
      'SELECT COUNT(*)::int AS edit_count FROM message_edit_history WHERE message_id = $1;',
      [messageId]
    );
    const editCount = Number(editCountResult.rows[0]?.edit_count || 0);
    if (editCount >= 5) {
      const error = new Error('This message has reached the maximum of 5 edits.');
      error.statusCode = 409;
      error.code = 'MESSAGE_EDIT_LIMIT_REACHED';
      throw error;
    }
    if (current.message_body === cleanMessageBody) {
      const error = new Error('The edited message is unchanged.');
      error.statusCode = 400;
      throw error;
    }

    const editNumber = editCount + 1;
    const historyResult = await client.query(
      `
      INSERT INTO message_edit_history (
        message_id, edited_by, edit_number, previous_message_body, new_message_body
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING edited_at;
      `,
      [messageId, currentUserId, editNumber, current.message_body, cleanMessageBody]
    );
    const editedAt = historyResult.rows[0].edited_at;
    const updateResult = await client.query(
      `
      UPDATE messages
      SET message_body = $2, edited_at = $3
      WHERE message_id = $1
      RETURNING message_id, sender_id, receiver_id, room_id, subject, message_body,
        sent_at, edited_at, is_read, attachment_url, reply_to_message_id, client_message_id;
      `,
      [messageId, cleanMessageBody, editedAt]
    );
    await client.query('COMMIT');

    const enriched = await enrichMessageRows([{ ...updateResult.rows[0], edit_count: editNumber }]);
    return enriched[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

exports.fetchMessageEditHistory = async (currentUserId, messageId) => {
  const messageResult = await db.query(
    'SELECT message_id, sender_id, receiver_id, room_id FROM messages WHERE message_id = $1 LIMIT 1;',
    [messageId]
  );
  const message = messageResult.rows[0];
  if (!message) {
    const error = new Error('Message not found.');
    error.statusCode = 404;
    throw error;
  }
  if (message.room_id) {
    await ensureRoomMembership(currentUserId, message.room_id);
  } else if (message.sender_id !== currentUserId && message.receiver_id !== currentUserId) {
    const error = new Error('You do not have access to this message.');
    error.statusCode = 403;
    throw error;
  }

  const historyResult = await db.query(
    `
    SELECT history_id, message_id, edit_number, previous_message_body, new_message_body, edited_at
    FROM message_edit_history
    WHERE message_id = $1
    ORDER BY edit_number DESC;
    `,
    [messageId]
  );
  return historyResult.rows;
};

exports.fetchUserSummary = getUserSummary;
