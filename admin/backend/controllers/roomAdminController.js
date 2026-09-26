'use strict';

const messageService = require('../services/messageService');
const roomAdminService = require('../services/roomAdminService');
const studentRealtimeRelayService = require('../services/studentRealtimeRelayService');

function getCurrentUserId(req) {
  return req.user?.userId || req.user?.user_id || req.user?.id || null;
}

function normalizeId(value) {
  return String(value || '').trim();
}

function uniqueIds(...values) {
  return [
    ...new Set(
      values
        .flat()
        .map((value) => normalizeId(value))
        .filter(Boolean)
    ),
  ];
}

function getStatusCode(error) {
  const parsed = Number(error?.statusCode || error?.status || 500);
  return Number.isFinite(parsed) && parsed >= 400 && parsed <= 599 ? parsed : 500;
}

function emitRoomRoleEvent(req, eventName, payload, targetUserIds = []) {
  const targets = uniqueIds(targetUserIds);
  const io = req.app?.get?.('io');

  if (io) {
    targets.forEach((userId) => {
      io.to(`user:${userId}`).emit(eventName, payload);
    });
  }

  studentRealtimeRelayService
    .relayMessageEvent({
      event: eventName,
      payload,
      targetUserIds: targets,
    })
    .catch((error) => {
      console.error('GROUP ADMIN REALTIME RELAY ERROR:', error.message);
    });
}

exports.manageRoomAdminRole = async (req, res, next) => {
  const action = String(req.body?.action || '').trim().toLowerCase();

  if (!['promote_admin', 'promote', 'demote_admin', 'demote'].includes(action)) {
    return next();
  }

  try {
    const currentUserId = getCurrentUserId(req);
    const roomId = normalizeId(req.params?.roomId);
    const memberId = normalizeId(req.body?.memberId || req.body?.member_id);

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!memberId) {
      return res.status(400).json({ message: 'A valid member is required.' });
    }

    const isPromotion = action === 'promote_admin' || action === 'promote';
    const result = isPromotion
      ? await roomAdminService.promoteRoomMemberToAdmin({
          actorId: currentUserId,
          roomId,
          memberId,
        })
      : await roomAdminService.demoteRoomAdminToMember({
          actorId: currentUserId,
          roomId,
          memberId,
        });

    const refreshed = await messageService.fetchRoomMembers(currentUserId, roomId);
    const members = refreshed?.items || [];
    const allRoomMemberIds = await messageService.fetchRoomMemberUserIds(roomId);
    const eventName = isPromotion
      ? 'room:member-promoted'
      : 'room:member-demoted';

    const payload = {
      room_id: roomId,
      roomId,
      member_id: memberId,
      memberId,
      actor_id: currentUserId,
      actorId: currentUserId,
      created_by: result.created_by,
      createdBy: result.created_by,
      changed: result.changed === true,
      system_message_id: result.system_message_id || null,
      systemMessageId: result.system_message_id || null,
      updated_at: new Date().toISOString(),
    };

    emitRoomRoleEvent(
      req,
      eventName,
      payload,
      uniqueIds(allRoomMemberIds, currentUserId, memberId)
    );

    const viewerIsCreator =
      String(result.created_by || '') === String(currentUserId || '');

    return res.json({
      success: true,
      action: isPromotion ? 'promote_admin' : 'demote_admin',
      ...result,
      members,
      roomMembers: members,
      memberCount: members.length,
      member_count: members.length,
      viewerIsAdmin: refreshed?.viewer_is_admin === true,
      viewer_is_admin: refreshed?.viewer_is_admin === true,
      viewerIsCreator,
      viewer_is_creator: viewerIsCreator,
      createdBy: result.created_by,
      created_by: result.created_by,
    });
  } catch (error) {
    console.error('MANAGE ROOM ADMIN ROLE ERROR:', error.message);
    return res.status(getStatusCode(error)).json({
      message: 'Failed to update group admin role',
      error: error.message,
      code: error.code || null,
    });
  }
};
