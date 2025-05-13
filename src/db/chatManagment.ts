import sqlite3 from 'sqlite3';
import { user } from '../types/user';
import * as chatType from '../types/chat';
import { run, get, getAll } from './userManagment';

const db = new sqlite3.Database('./src/db/userdata.db');

// ########################
// #         ROOMS        #
// ########################
// Create room
export const createChatRoom = (
  ownerID: number,
  name: string = 'Room',
) =>
  run(
    `INSERT INTO chatRooms (ownerID, name) VALUES (?, ?)`,
    [ownerID, name]
  );

// Get room by ID
export const getChatRoomByID = (roomID: number) =>
  get(`SELECT * FROM chatRooms WHERE roomID = ?`, [roomID]);

// Get all rooms for a user
export const getChatRoomsByOwner = (ownerID: number) =>
  getAll(`SELECT * FROM chatRooms WHERE ownerID = ?`, [ownerID]);

// ########################
// #     ROOM MEMBERS     #
// ########################
// Add a user to a room
export const createChatRoomMember = (roomID: number, userID: number) =>
  run(`INSERT INTO chatRoomMembers (roomID, userID) VALUES (?, ?)`, [roomID, userID]);

// Get all members of a room
export const getChatRoomMembers = (roomID: number) =>
  getAll(`SELECT userID FROM chatRoomMembers WHERE roomID = ?`, [roomID]);

// Get all rooms for a given user
export const getChatRoomsForUser = (userID: number) =>
  getAll(`SELECT * FROM chatRoomMembers WHERE userID = ?`, [userID]);

// Remove member from a room
export const removeChatRoomMember = (roomID: number, userID: number) =>
  run(
    `DELETE FROM chatRoomMembers WHERE roomID = ? AND userID = ?`,
    [roomID, userID]
  );

// ########################
// #       MESSAGES       #
// ########################
// Create message
export const createMessage = (roomID: number, authorID: number, content: string) =>
  run(`INSERT INTO messages (roomID, authorID, content) VALUES (?, ?, ?)`, [roomID, authorID, content]);

// Get messages for a room
export const getMessagesByChatRoom = (roomID: number, limit: number = 50) =>
  getAll(
    `SELECT * FROM messages WHERE roomID = ? ORDER BY created_at DESC LIMIT ?`,
    [roomID, limit]
  );

// Get messages by a specific user in a room
export const getMessagesByUserInChatRoom = (authorID: number, roomID: number) =>
  getAll(
    `SELECT * FROM messages WHERE roomID = ? AND authorID = ? ORDER BY created_at DESC`,
    [roomID, authorID]
  );

// ########################
// #       FRIENDS        #
// ########################
// Add a friend
export const addFriend = (userID: number, friendID: number) =>
  run(
    `INSERT INTO user_relationships (user_id, related_user_id, type) VALUES (?, ?, 'friend')`,
    [userID, friendID]
  );

// Remove a friend
export const removeFriend = (userID: number, friendID: number) =>
  run(
    `DELETE FROM user_relationships WHERE user_id = ? AND related_user_id = ? AND type = 'friend'`,
    [userID, friendID]
  );

// Get friends list for a user
export const getFriends = (userID: number) =>
  getAll(
    `SELECT u.id, u.username FROM users u
     JOIN user_relationships r ON u.id = r.related_user_id
     WHERE r.user_id = ? AND r.type = 'friend'`,
    [userID]
  );

// ########################
// #        BLOCKS        #
// ########################
// Block a user
export const blockUser = (userID: number, blockedID: number) =>
  run(
    `INSERT INTO user_relationships (user_id, related_user_id, type) VALUES (?, ?, 'block')`,
    [userID, blockedID]
  );

// Unblock a user
export const unblockUser = (userID: number, blockedID: number) =>
  run(
    `DELETE FROM user_relationships WHERE user_id = ? AND related_user_id = ? AND type = 'block'`,
    [userID, blockedID]
  );

// Get blocked users list for a user
export const getBlockedUsers = (userID: number) =>
  getAll(
    `SELECT u.id, u.username FROM users u
     JOIN user_relationships r ON u.id = r.related_user_id
     WHERE r.user_id = ? AND r.type = 'block'`,
    [userID]
  );
