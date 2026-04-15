const fs = require('fs');
const path = require('path');

function replaceInFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/group_id/g, 'room_id');
  content = content.replace(/groupId/g, 'roomId');
  content = content.replace(/groupName/g, 'roomName');
  content = content.replace(/group_name/g, 'room_name');
  content = content.replace(/chat_groups/g, 'chat_rooms');
  content = content.replace(/chat_group_members/g, 'chat_room_members');
  // Be careful with routes and frontend calls
  content = content.replace(/\/api\/messages\/groups/g, '/api/messages/rooms');
  content = content.replace(/fetchGroupThread/g, 'fetchRoomThread');
  content = content.replace(/sendGroupMessage/g, 'sendRoomMessage');
  content = content.replace(/markGroupThreadRead/g, 'markRoomThreadRead');
  content = content.replace(/listGroupsForAdmin/g, 'listRoomsForAdmin');
  content = content.replace(/listGroupsForUser/g, 'listRoomsForUser');
  content = content.replace(/createGroup/g, 'createRoom');
  content = content.replace(/enterGroup/g, 'enterRoom');
  content = content.replace(/ChatGroup/g, 'ChatRoom');
  content = content.replace(/groups/g, 'rooms');
  
  // Undo specific replacements that would break syntax if they collided
  content = content.replace(/is_room/g, 'is_group'); // if I accidentally replace group -> room

  fs.writeFileSync(file, content);
}

replaceInFile('backend/services/messageService.js');
replaceInFile('backend/server.js');
replaceInFile('mobile/smartpdm_mobileapp/lib/shared/models/chat_message.dart');
replaceInFile('mobile/smartpdm_mobileapp/lib/features/messaging/data/services/message_service.dart');
replaceInFile('mobile/smartpdm_mobileapp/lib/features/messaging/presentation/providers/messaging_provider.dart');
replaceInFile('mobile/smartpdm_mobileapp/lib/features/messaging/presentation/screens/chat_list_screen.dart');
replaceInFile('mobile/smartpdm_mobileapp/lib/features/messaging/presentation/screens/messaging_screen.dart');
replaceInFile('mobile/smartpdm_mobileapp/lib/app/routes/app_router.dart');
replaceInFile('admin/frontend/src/pages/AdminMessages.jsx');
