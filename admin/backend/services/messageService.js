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

  const { data, error } = await supabase.storage
    .from('avatars')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  if (error) {
    return rawValue;
  }

  return data?.signedUrl || rawValue;
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
    LEFT JOIN students st ON st.user_id = u.user_id
    LEFT JOIN admin_profiles ap ON ap.user_id = u.user_id
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
    WHERE room_id = $1 AND user_id = $2
    LIMIT 1;
    `,
    [roomId, userId]
  );

  if (!result.rows.length) {
    throw new Error('You are not a member of this chat room');
  }
}

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
        m.is_read
      FROM messages m
      WHERE (m.sender_id = $1 OR m.receiver_id = $1)
        AND m.room_id IS NULL
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
        AND COALESCE(is_read, false) = false
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
      COALESCE(m.is_read, false) AS is_read,
      m.attachment_url
    FROM messages m
    WHERE
      m.room_id IS NULL
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
  const result = await db.query(
    `
    UPDATE messages
    SET is_read = true
    WHERE room_id IS NULL
      AND receiver_id = $1
      AND sender_id = $2
      AND COALESCE(is_read, false) = false
    RETURNING message_id;
    `,
    [currentUserId, counterpartyId]
  );

  return result.rows.map((row) => row.message_id);
};

exports.sendMessage = async ({ senderId, receiverId, subject = null, messageBody, attachmentUrl = null }) => {
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
  const senderSummary = await getUserSummary(senderId);

  return {
    ...message,
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
    )
    SELECT
      cr.room_id,
      cr.room_name,
      cr.created_by,
      cr.created_at,
      COALESCE(lrm.message_body, '') AS last_message,
      lrm.subject,
      lrm.sent_at AS last_sent_at,
      COALESCE(mc.member_count, 0) AS member_count
    FROM chat_room_members my_membership
    JOIN chat_rooms cr
      ON cr.room_id = my_membership.room_id
    LEFT JOIN latest_room_message lrm
      ON lrm.room_id = cr.room_id
    LEFT JOIN member_counts mc
      ON mc.room_id = cr.room_id
    WHERE my_membership.user_id = $1
      AND COALESCE(cr.is_archived, false) = false
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
    conversation_type: 'group',
  }));
};

exports.createRoom = async ({ creatorId, roomName = null, memberIds = [] }) => {
  const normalizedCreatorId = String(creatorId || '').trim();
  const normalizedMemberIds = memberIds
    .map((memberId) => String(memberId || '').trim())
    .filter(Boolean);
  const uniqueMemberIds = [...new Set(normalizedMemberIds.filter((userId) => userId !== normalizedCreatorId))];

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
      ON CONFLICT (room_id, user_id) DO UPDATE
      SET is_admin = true;
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
        VALUES ($1, $2, $3)
        ON CONFLICT (room_id, user_id) DO NOTHING;
        `,
        [room.room_id, userId, false]
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
      COALESCE(m.is_read, false) AS is_read,
      m.attachment_url
    FROM messages m
    WHERE m.room_id = $1
    ORDER BY m.sent_at ASC, m.message_id ASC;
    `,
    [roomId]
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

exports.sendRoomMessage = async ({ senderId, roomId, subject = null, messageBody, attachmentUrl = null }) => {
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
  const senderSummary = await getUserSummary(senderId);

  return {
    ...message,
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
      ON CONFLICT (room_id, user_id) DO NOTHING
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

  const result = await db.query(
    `
    UPDATE messages
    SET is_read = true
    WHERE room_id = $1
      AND sender_id <> $2
      AND COALESCE(is_read, false) = false
    RETURNING message_id;
    `,
    [roomId, currentUserId]
  );

  return result.rows.map((row) => row.message_id);
};

exports.fetchScholarMembers = async () => {
  let result;

  try {
    // Preferred schema: scholars are tracked directly in the students table.
    result = await db.query(
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
        COALESCE(sp.program_name, ac.course_code, 'No Program') AS program_name,
        COALESCE(b.benefactor_name, 'Unassigned Benefactor') AS benefactor_name
      FROM students st
      LEFT JOIN users u
        ON st.user_id = u.user_id
      LEFT JOIN academic_course ac
        ON st.course_id = ac.course_id
      LEFT JOIN scholarship_program sp
        ON st.current_program_id = sp.program_id
      LEFT JOIN benefactors b
        ON sp.benefactor_id = b.benefactor_id
      WHERE COALESCE(st.is_archived, false) = false
        AND COALESCE(st.scholar_is_archived, false) = false
        AND COALESCE(st.scholarship_status, 'None') IN ('Active', 'On Hold', 'Inactive', 'Removed')
        AND u.user_id IS NOT NULL
      ORDER BY student_name ASC;
      `
    );
  } catch (modernErr) {
    const message = String(modernErr?.message || '').toLowerCase();
    const isSchemaMismatch =
      message.includes('current_program_id') ||
      message.includes('scholar_is_archived') ||
      message.includes('scholarship_status');

    if (!isSchemaMismatch) {
      throw modernErr;
    }

    try {
      // Legacy schema fallback: current_scholars table stores program linkage.
      result = await db.query(
        `
        SELECT
          u.user_id,
          s.scholar_id,
          st.student_id,
          st.pdm_id AS student_number,
          st.first_name,
          st.last_name,
          st.profile_photo_url,
          TRIM(COALESCE(st.first_name, '') || ' ' || COALESCE(st.last_name, '')) AS student_name,
          COALESCE(sp.program_name, ac.course_code, 'No Program') AS program_name,
          COALESCE(b.benefactor_name, 'Unassigned Benefactor') AS benefactor_name
        FROM current_scholars s
        JOIN students st
          ON s.student_id = st.student_id
        LEFT JOIN users u
          ON st.user_id = u.user_id
        LEFT JOIN academic_course ac
          ON st.course_id = ac.course_id
        LEFT JOIN scholarship_program sp
          ON s.program_id = sp.program_id
        LEFT JOIN benefactors b
          ON sp.benefactor_id = b.benefactor_id
        WHERE COALESCE(st.is_archived, false) = false
          AND u.user_id IS NOT NULL
        ORDER BY student_name ASC;
        `
      );
    } catch (legacyErr) {
      const legacyMessage = String(legacyErr?.message || '').toLowerCase();
      const isCurrentScholarsMissing = legacyMessage.includes('current_scholars');

      if (!isCurrentScholarsMissing) {
        throw legacyErr;
      }

      // Older fallback: scholars table.
      result = await db.query(
        `
        SELECT
          u.user_id,
          s.scholar_id,
          st.student_id,
          st.pdm_id AS student_number,
          st.first_name,
          st.last_name,
          st.profile_photo_url,
          TRIM(COALESCE(st.first_name, '') || ' ' || COALESCE(st.last_name, '')) AS student_name,
          COALESCE(sp.program_name, ac.course_code, 'No Program') AS program_name,
          COALESCE(b.benefactor_name, 'Unassigned Benefactor') AS benefactor_name
        FROM scholars s
        JOIN students st
          ON s.student_id = st.student_id
        LEFT JOIN users u
          ON st.user_id = u.user_id
        LEFT JOIN academic_course ac
          ON st.course_id = ac.course_id
        LEFT JOIN scholarship_program sp
          ON s.program_id = sp.program_id
        LEFT JOIN benefactors b
          ON sp.benefactor_id = b.benefactor_id
        WHERE COALESCE(st.is_archived, false) = false
          AND u.user_id IS NOT NULL
        ORDER BY student_name ASC;
        `
      );
    }
  }

  const items = [];

  for (const row of result.rows) {
    items.push({
      user_id: row.user_id,
      scholar_id: row.scholar_id,
      student_id: row.student_id,
      student_number: row.student_number || '',
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      student_name: row.student_name || 'Unknown Scholar',
      profile_photo_url: row.profile_photo_url || null,
      avatar_url: await resolveAvatarUrl(row.profile_photo_url),
      program_name: row.program_name || 'No Program',
      benefactor_name: row.benefactor_name || 'Unassigned Benefactor',
    });
  }

  return items;
};
