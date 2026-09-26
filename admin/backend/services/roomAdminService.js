'use strict';

const db = require('../config/db');

function normalizeId(value) {
  return String(value || '').trim();
}

async function getDisplayName(client, userId) {
  const result = await client.query(
    `
      SELECT COALESCE(
        NULLIF(TRIM(CONCAT(st.first_name, ' ', st.last_name)), ''),
        NULLIF(TRIM(CONCAT(ap.first_name, ' ', ap.last_name)), ''),
        NULLIF(TRIM(u.username), ''),
        NULLIF(TRIM(u.email), ''),
        'Unknown User'
      ) AS display_name
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

  return result.rows[0]?.display_name || 'Unknown User';
}

async function ensureCreatorCanManageAdmins(client, actorId, roomId) {
  const result = await client.query(
    `
      SELECT
        cr.room_id,
        cr.created_by,
        crm.user_id AS member_user_id,
        crm.is_admin AS actor_is_admin
      FROM chat_rooms cr
      LEFT JOIN chat_room_members crm
        ON crm.room_id = cr.room_id
       AND crm.user_id = $2
      WHERE cr.room_id = $1
      LIMIT 1
      FOR UPDATE OF cr;
    `,
    [roomId, actorId]
  );

  const room = result.rows[0];

  if (!room) {
    const error = new Error('Group chat not found.');
    error.statusCode = 404;
    throw error;
  }

  if (!room.member_user_id) {
    const error = new Error('You are not a member of this chat room.');
    error.statusCode = 403;
    throw error;
  }

  if (String(room.created_by) !== String(actorId)) {
    const error = new Error('Only the group creator can promote or demote group admins.');
    error.statusCode = 403;
    error.code = 'GROUP_CREATOR_REQUIRED';
    throw error;
  }

  return room;
}

async function setRoomMemberAdminRole({ actorId, roomId, memberId, isAdmin }) {
  const normalizedActorId = normalizeId(actorId);
  const normalizedRoomId = normalizeId(roomId);
  const normalizedMemberId = normalizeId(memberId);

  if (!normalizedActorId || !normalizedRoomId || !normalizedMemberId) {
    const error = new Error('A valid group, creator, and member are required.');
    error.statusCode = 400;
    throw error;
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const room = await ensureCreatorCanManageAdmins(
      client,
      normalizedActorId,
      normalizedRoomId
    );

    const memberResult = await client.query(
      `
        SELECT user_id, is_admin
        FROM chat_room_members
        WHERE room_id = $1
          AND user_id = $2
        LIMIT 1
        FOR UPDATE;
      `,
      [normalizedRoomId, normalizedMemberId]
    );

    const member = memberResult.rows[0];

    if (!member) {
      const error = new Error('Group member not found.');
      error.statusCode = 404;
      throw error;
    }

    if (!isAdmin && String(normalizedMemberId) === String(room.created_by)) {
      const error = new Error('The group creator cannot be demoted.');
      error.statusCode = 400;
      error.code = 'GROUP_CREATOR_CANNOT_BE_DEMOTED';
      throw error;
    }

    if (member.is_admin === isAdmin) {
      await client.query('COMMIT');
      return {
        room_id: normalizedRoomId,
        member_id: normalizedMemberId,
        created_by: room.created_by,
        changed: false,
        is_admin: member.is_admin === true,
        promoted: false,
        demoted: false,
        system_message_id: null,
      };
    }

    await client.query(
      `
        UPDATE chat_room_members
        SET is_admin = $3
        WHERE room_id = $1
          AND user_id = $2;
      `,
      [normalizedRoomId, normalizedMemberId, isAdmin]
    );

    const [actorName, memberName] = await Promise.all([
      getDisplayName(client, normalizedActorId),
      getDisplayName(client, normalizedMemberId),
    ]);

    const systemText = isAdmin
      ? `${actorName} made ${memberName} a group admin`
      : `${actorName} removed ${memberName} as a group admin`;

    const messageResult = await client.query(
      `
        INSERT INTO messages (
          sender_id,
          receiver_id,
          room_id,
          subject,
          message_body,
          is_read
        )
        VALUES ($1, NULL, $2, 'system', $3, true)
        RETURNING message_id, sent_at;
      `,
      [normalizedActorId, normalizedRoomId, systemText]
    );

    await client.query('COMMIT');

    return {
      room_id: normalizedRoomId,
      member_id: normalizedMemberId,
      created_by: room.created_by,
      changed: true,
      is_admin: isAdmin,
      promoted: isAdmin,
      demoted: !isAdmin,
      system_message_id: messageResult.rows[0]?.message_id || null,
      system_message_sent_at: messageResult.rows[0]?.sent_at || null,
      system_message_body: systemText,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

exports.promoteRoomMemberToAdmin = async ({ actorId, roomId, memberId }) =>
  setRoomMemberAdminRole({
    actorId,
    roomId,
    memberId,
    isAdmin: true,
  });

exports.demoteRoomAdminToMember = async ({ actorId, roomId, memberId }) =>
  setRoomMemberAdminRole({
    actorId,
    roomId,
    memberId,
    isAdmin: false,
  });
