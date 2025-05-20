"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCleanHistory = exports.getBlockedUsers = exports.isBlocked = exports.unblockUser = exports.blockUser = exports.getFriends = exports.removeFriend = exports.addFriend = exports.getMessagesByUserInChatRoom = exports.getMessagesByChatRoom = exports.createMessage = exports.removeChatRoomMember = exports.getChatRoomsForUser = exports.getChatRoomMembers = exports.createChatRoomMember = exports.getChatRoomsByUserId = exports.deleteChatRoomByID = exports.getChatRoomsByOwner = exports.getChatRoomByID = exports.getChatRoomByName = exports.createChatRoom = void 0;
exports.setDb = setDb;
exports.createOrGetRoom = createOrGetRoom;
const userManagement_1 = require("./userManagement");
let db;
function setDb(database) {
    db = database;
}
// ########################
// #         ROOMS        #
// ########################
// Create room
const createChatRoom = (ownerID, name = 'Room') => (0, userManagement_1.run)(`INSERT INTO chatRooms (ownerID, name) VALUES (?, ?)`, [ownerID, name]);
exports.createChatRoom = createChatRoom;
// Get room by name
const getChatRoomByName = (name) => (0, userManagement_1.get)(`SELECT roomID FROM chatRooms WHERE name = ?`, [name]);
exports.getChatRoomByName = getChatRoomByName;
// create or get room
async function createOrGetRoom(ownerID, name) {
    const existingRoom = await (0, exports.getChatRoomByName)(name);
    if (existingRoom) {
        return existingRoom;
    }
    const result = await (0, exports.createChatRoom)(ownerID, name);
    return { roomID: result.lastID };
}
// Get room by ID
const getChatRoomByID = (roomID) => (0, userManagement_1.get)(`SELECT * FROM chatRooms WHERE roomID = ?`, [roomID]);
exports.getChatRoomByID = getChatRoomByID;
// Get all rooms for a user
const getChatRoomsByOwner = (ownerID) => (0, userManagement_1.getAll)(`SELECT * FROM chatRooms WHERE ownerID = ?`, [ownerID]);
exports.getChatRoomsByOwner = getChatRoomsByOwner;
// Delete chatroom by ID
const deleteChatRoomByID = (roomID) => (0, userManagement_1.run)(`DELETE FROM chatRooms WHERE roomID = ?`, [roomID]);
exports.deleteChatRoomByID = deleteChatRoomByID;
// Get all the rooms that a user is in
const getChatRoomsByUserId = (userID) => (0, userManagement_1.getAll)(`
    SELECT r.*
    FROM chatRooms r
    JOIN chatRoomMembers m ON r.roomID = m.roomID
    WHERE m.userID = ?
    `, [userID]);
exports.getChatRoomsByUserId = getChatRoomsByUserId;
// ########################
// #     ROOM MEMBERS     #
// ########################
// Add a user to a room
const createChatRoomMember = (roomID, userID) => (0, userManagement_1.run)(`INSERT OR IGNORE INTO chatRoomMembers (roomID, userID) VALUES (?, ?)`, [roomID, userID]);
exports.createChatRoomMember = createChatRoomMember;
// Get all members of a room
const getChatRoomMembers = (roomID) => (0, userManagement_1.getAll)(`SELECT userID FROM chatRoomMembers WHERE roomID = ?`, [roomID]);
exports.getChatRoomMembers = getChatRoomMembers;
// Get all rooms for a given user
const getChatRoomsForUser = (userID) => (0, userManagement_1.getAll)(`SELECT * FROM chatRoomMembers WHERE userID = ?`, [userID]);
exports.getChatRoomsForUser = getChatRoomsForUser;
// Remove member from a room
const removeChatRoomMember = (roomID, userID) => (0, userManagement_1.run)(`DELETE FROM chatRoomMembers WHERE roomID = ? AND userID = ?`, [roomID, userID]);
exports.removeChatRoomMember = removeChatRoomMember;
// ########################
// #       MESSAGES       #
// ########################
// Create message
const createMessage = (roomID, authorID, content) => (0, userManagement_1.run)(`INSERT INTO messages (roomID, authorID, content) VALUES (?, ?, ?)`, [roomID, authorID, content]);
exports.createMessage = createMessage;
// Get messages for a room
const getMessagesByChatRoom = (roomID, limit = 50) => (0, userManagement_1.getAll)(`SELECT * FROM messages WHERE roomID = ? ORDER BY created_at DESC LIMIT ?`, [roomID, limit]);
exports.getMessagesByChatRoom = getMessagesByChatRoom;
// Get messages by a specific user in a room
const getMessagesByUserInChatRoom = (authorID, roomID) => (0, userManagement_1.getAll)(`SELECT * FROM messages WHERE roomID = ? AND authorID = ? ORDER BY created_at DESC`, [roomID, authorID]);
exports.getMessagesByUserInChatRoom = getMessagesByUserInChatRoom;
// ########################
// #       FRIENDS        #
// ########################
// Add a friend
const addFriend = (userID, friendID) => (0, userManagement_1.run)(`INSERT OR IGNORE INTO user_relationships (user_id, related_user_id, type) VALUES (?, ?, 'friend')`, [userID, friendID]);
exports.addFriend = addFriend;
// Remove a friend
const removeFriend = (userID, friendID) => (0, userManagement_1.run)(`DELETE FROM user_relationships WHERE user_id = ? AND related_user_id = ? AND type = 'friend'`, [userID, friendID]);
exports.removeFriend = removeFriend;
// Get friends list for a user
const getFriends = (userID) => (0, userManagement_1.getAll)(`SELECT u.our_index, u.username FROM users u
     JOIN user_relationships r ON u.our_index = r.related_user_id
     WHERE r.user_id = ? AND r.type = 'friend'`, [userID]);
exports.getFriends = getFriends;
// ########################
// #        BLOCKS        #
// ########################
const blockUser = (userID, blockedID) => (0, userManagement_1.run)(`INSERT OR IGNORE INTO user_relationships (user_id, related_user_id, type) VALUES (?, ?, 'block')`, [userID, blockedID]);
exports.blockUser = blockUser;
// Unblock a user
const unblockUser = (userID, blockedID) => (0, userManagement_1.run)(`DELETE FROM user_relationships WHERE user_id = ? AND related_user_id = ? AND type = 'block'`, [userID, blockedID]);
exports.unblockUser = unblockUser;
const isBlocked = async (userID, authorID) => {
    const result = await (0, userManagement_1.get)(`SELECT 1 FROM user_relationships WHERE user_id = ? AND related_user_id = ? AND type = 'block' LIMIT 1`, [userID, authorID]);
    return result !== null;
};
exports.isBlocked = isBlocked;
// Get blocked users list for a user
const getBlockedUsers = (userID) => (0, userManagement_1.getAll)(`SELECT u.our_index, u.username FROM users u
     JOIN user_relationships r ON u.our_index = r.related_user_id
     WHERE r.user_id = ? AND r.type = 'block'`, [userID]);
exports.getBlockedUsers = getBlockedUsers;
// ########################
// #    Multi-db          #
// ########################
const getCleanHistory = async (roomID, userID, limit = 50) => {
    return (0, userManagement_1.getAll)(`
    SELECT m.*
    FROM messages m
    LEFT JOIN user_relationships r
      ON m.authorID = r.related_user_id
      AND r.user_id = ?
      AND r.type = 'block'
    WHERE m.roomID = ? AND r.id IS NULL
    ORDER BY m.created_at DESC
    LIMIT ?
    `, [userID, roomID, limit]);
};
exports.getCleanHistory = getCleanHistory;
