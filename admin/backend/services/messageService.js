const db = require('../config/db');

async function getUserSummary(userId) {
  const result = await db.query(
    `
    SELECT
      u.user_id,
      u.role,
      u.email,
      st.pdm_id AS student_number,
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

  return result.rows[0] || null;
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

  return result.rows;
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

  return result.rows[0];
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
  const uniqueMemberIds = [...new Set([creatorId, ...memberIds.filter(Boolean)])];
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
      [roomName || 'New Group Chat', creatorId]
    );

    const room = roomResult.rows[0];

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
        [room.room_id, userId, userId === creatorId]
      );
    }

    await client.query('COMMIT');

    return {
      ...room,
      member_ids: uniqueMemberIds,
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

  return result.rows;
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

  return result.rows[0];
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
  const result = await db.query(
    `
    SELECT
      u.user_id,
      s.scholar_id,
      st.student_id,
      st.pdm_id AS student_number,
      TRIM(COALESCE(st.first_name, '') || ' ' || COALESCE(st.last_name, '')) AS student_name,
      COALESCE(ac.course_code, 'No Program') AS program_name,
      COALESCE(sp.program_name, 'Unassigned Benefactor') AS benefactor_name
    FROM scholars s
    JOIN students st
      ON s.student_id = st.student_id
    LEFT JOIN users u
      ON st.user_id = u.user_id
    LEFT JOIN academic_course ac
      ON st.course_id = ac.course_id
    LEFT JOIN scholarship_program sp
      ON s.program_id = sp.program_id
    WHERE COALESCE(st.is_archived, false) = false
      AND u.user_id IS NOT NULL
    ORDER BY student_name ASC;
    `
  );

  return result.rows.map((row) => ({
    user_id: row.user_id,
    scholar_id: row.scholar_id,
    student_id: row.student_id,
    student_number: row.student_number || '',
    student_name: row.student_name || 'Unknown Scholar',
    program_name: row.program_name || 'No Program',
    benefactor_name: row.benefactor_name || 'Unassigned Benefactor',
  }));
};