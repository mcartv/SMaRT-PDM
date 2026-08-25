const db = require('../config/db');
const supabase = require('../config/supabase');

function extractAvatarStoragePath(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return null;

  if (!/^https?:\/\//i.test(rawValue)) {
    return rawValue.replace(/^avatars\//, '');
  }

  const markers = [
    '/storage/v1/object/public/avatars/',
    '/storage/v1/object/sign/avatars/',
    '/storage/v1/object/authenticated/avatars/',
  ];

  for (const marker of markers) {
    const markerIndex = rawValue.indexOf(marker);
    if (markerIndex >= 0) {
      return rawValue.slice(markerIndex + marker.length).split('?')[0];
    }
  }

  return null;
}

async function resolveAvatarUrl(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return null;

  const storagePath = extractAvatarStoragePath(rawValue);
  if (!storagePath) {
    return rawValue;
  }

  try {
    const { data, error } = await supabase.storage
      .from('avatars')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

    if (error) {
      return rawValue;
    }

    return data?.signedUrl || rawValue;
  } catch {
    return rawValue;
  }
}

async function getUserSummary(userId) {
  const result = await db.query(
    `
    SELECT
      u.user_id,
      u.role,
      u.email,
      st.pdm_id AS student_number,
      st.profile_photo_url,
      CASE
        WHEN st.student_id IS NOT NULL THEN TRIM(COALESCE(st.first_name, '') || ' ' || COALESCE(st.last_name, ''))
        WHEN ap.admin_id IS NOT NULL THEN TRIM(COALESCE(ap.first_name, '') || ' ' || COALESCE(ap.last_name, ''))
        ELSE COALESCE(u.email, 'Unknown User')
      END AS display_name
    FROM users u
    LEFT JOIN students st
      ON st.user_id = u.user_id
    LEFT JOIN admin_profiles ap
      ON ap.user_id = u.user_id
    WHERE u.user_id = $1
    LIMIT 1;
    `,
    [userId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    ...row,
    profile_photo_url: row.profile_photo_url || null,
    avatar_url: await resolveAvatarUrl(row.profile_photo_url),
  };
}

async function ensureRoomMembership(userId, roomId) {
  const result = await db.query(
    `
    SELECT membership_id
    FROM chat_room_members
    WHERE room_id = $1
      AND user_id = $2
    LIMIT 1;
    `,
    [roomId, userId]
  );

  if (!result.rows.length) {
    throw new Error('You are not a member of this chat room');
  }
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
        subject,
        message_body,
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
      l.subject,
      l.message_body,
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
    const summary = await getUserSummary(row.counterparty_id);

    conversations.push({
      counterparty_id: row.counterparty_id,
      name: summary?.display_name || 'Unknown User',
      student_number: summary?.student_number || '',
      profile_photo_url: summary?.profile_photo_url || null,
      avatar_url: summary?.avatar_url || null,
      role: summary?.role || '',
      email: summary?.email || '',
      last_message: row.message_body || '',
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
      CASE
        WHEN m.sender_id = $1 THEN true
        ELSE COALESCE(mrs.is_read, m.is_read, false)
      END AS is_read,
      m.attachment_url
    FROM messages m
    LEFT JOIN message_read_states mrs
      ON mrs.message_id = m.message_id
     AND mrs.user_id = $1
    WHERE m.room_id IS NULL
      AND (
        (m.sender_id = $1 AND m.receiver_id = $2)
        OR
        (m.sender_id = $2 AND m.receiver_id = $1)
      )
    ORDER BY m.sent_at ASC, m.message_id ASC;
    `,
    [currentUserId, counterpartyId]
  );

  const summaries = new Map();

  for (const senderId of [...new Set(result.rows.map((row) => row.sender_id).filter(Boolean))]) {
    summaries.set(senderId, await getUserSummary(senderId));
  }

  return result.rows.map((row) => ({
    ...row,
    sender_name: summaries.get(row.sender_id)?.display_name || 'Unknown User',
    sender_profile_photo_url: summaries.get(row.sender_id)?.profile_photo_url || null,
    sender_avatar_url: summaries.get(row.sender_id)?.avatar_url || null,
  }));
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
}) => {
  const result = await db.query(
    `
    INSERT INTO messages (
      sender_id,
      receiver_id,
      room_id,
      subject,
      message_body,
      attachment_url
    )
    VALUES ($1, $2, NULL, $3, $4, $5)
    RETURNING
      message_id,
      sender_id,
      receiver_id,
      room_id,
      subject,
      message_body,
      sent_at,
      is_read,
      attachment_url;
    `,
    [senderId, receiverId, subject, messageBody, attachmentUrl]
  );

  const message = result.rows[0];

  await createPrivateReadStates(message.message_id, senderId, receiverId);

  await db.query(
    `
    DELETE FROM message_thread_archives
    WHERE thread_type = 'private'
      AND (
        (user_id = $1 AND counterparty_id = $2)
        OR
        (user_id = $2 AND counterparty_id = $1)
      );
    `,
    [senderId, receiverId]
  );

  const senderSummary = await getUserSummary(senderId);

  return {
    ...message,
    is_read: true,
    sender_name: senderSummary?.display_name || 'Unknown User',
    sender_profile_photo_url: senderSummary?.profile_photo_url || null,
    sender_avatar_url: senderSummary?.avatar_url || null,
  };
};

exports.fetchRooms = async (currentUserId) => {
  const result = await db.query(
    `
    WITH latest_room_message AS (
      SELECT DISTINCT ON (m.room_id)
        m.room_id,
        m.message_id,
        m.subject,
        m.message_body,
        m.sent_at
      FROM messages m
      WHERE m.room_id IS NOT NULL
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
      GROUP BY m.room_id
    )
    SELECT
      cr.room_id,
      cr.room_name,
      cr.created_by,
      cr.created_at,
      COALESCE(lrm.message_body, '') AS last_message,
      lrm.subject,
      lrm.sent_at AS last_sent_at,
      COALESCE(mc.member_count, 0) AS member_count,
      COALESCE(uc.unread_count, 0) AS unread_count
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

  return result.rows.map((row) => ({
    room_id: row.room_id,
    room_name: row.room_name || 'Untitled Group',
    created_by: row.created_by,
    created_at: row.created_at,
    last_message: row.last_message || '',
    subject: row.subject || '',
    last_sent_at: row.last_sent_at,
    member_count: Number(row.member_count || 0),
    unread_count: Number(row.unread_count || 0),
    conversation_type: 'group',
  }));
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
      COALESCE(mrs.is_read, CASE WHEN m.sender_id = $2 THEN true ELSE false END) AS is_read,
      m.attachment_url
    FROM messages m
    LEFT JOIN message_read_states mrs
      ON mrs.message_id = m.message_id
     AND mrs.user_id = $2
    WHERE m.room_id = $1
    ORDER BY m.sent_at ASC, m.message_id ASC;
    `,
    [roomId, currentUserId]
  );

  const summaries = new Map();

  for (const senderId of [...new Set(result.rows.map((row) => row.sender_id).filter(Boolean))]) {
    summaries.set(senderId, await getUserSummary(senderId));
  }

  return result.rows.map((row) => ({
    ...row,
    sender_name: summaries.get(row.sender_id)?.display_name || 'Unknown User',
    sender_profile_photo_url: summaries.get(row.sender_id)?.profile_photo_url || null,
    sender_avatar_url: summaries.get(row.sender_id)?.avatar_url || null,
  }));
};

exports.sendRoomMessage = async ({
  senderId,
  roomId,
  subject = null,
  messageBody,
  attachmentUrl = null,
}) => {
  await ensureRoomMembership(senderId, roomId);

  const result = await db.query(
    `
    INSERT INTO messages (
      sender_id,
      receiver_id,
      room_id,
      subject,
      message_body,
      attachment_url
    )
    VALUES ($1, NULL, $2, $3, $4, $5)
    RETURNING
      message_id,
      sender_id,
      receiver_id,
      room_id,
      subject,
      message_body,
      sent_at,
      is_read,
      attachment_url;
    `,
    [senderId, roomId, subject, messageBody, attachmentUrl]
  );

  const message = result.rows[0];

  await createRoomReadStates(message.message_id, roomId, senderId);

  await db.query(
    `
    DELETE FROM message_thread_archives
    WHERE thread_type = 'group'
      AND room_id = $1;
    `,
    [roomId]
  );

  const senderSummary = await getUserSummary(senderId);

  return {
    ...message,
    is_read: true,
    sender_name: senderSummary?.display_name || 'Unknown User',
    sender_profile_photo_url: senderSummary?.profile_photo_url || null,
    sender_avatar_url: senderSummary?.avatar_url || null,
  };
};

exports.addRoomMembers = async ({ actorId, roomId, memberIds = [] }) => {
  await ensureRoomMembership(actorId, roomId);

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
      ON CONFLICT (room_id, user_id)
      DO NOTHING
      RETURNING membership_id, room_id, user_id, joined_at, is_admin;
      `,
      [roomId, userId]
    );

    if (result.rows[0]) {
      inserted.push(result.rows[0]);
    }
  }

  return {
    room_id: roomId,
    added_count: inserted.length,
    members: inserted,
  };
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

exports.archiveRoom = async (currentUserId, roomId) => {
  await ensureRoomMembership(currentUserId, roomId);

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
      COALESCE(member_count.member_count, 0)::int AS member_count
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
    const summary = await getUserSummary(archive.counterparty_id);

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

exports.restoreRoom = async (currentUserId, roomId) => {
  await ensureRoomMembership(currentUserId, roomId);

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