import sqlite3 from 'sqlite3';
import { user } from '../types/user';
import * as chatType from '../types/chat';
import { run, get, getAll } from './userManagement';


let db: sqlite3.Database;

export function setDb(database: sqlite3.Database) {
  db = database;
}

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


// Get room by name
export const getChatRoomByName = (name: string) =>
  get<{ roomID: number }>(`SELECT roomID FROM chatRooms WHERE name = ?`, [name]);


// create or get room
export async function createOrGetRoom(ownerID: number, name: string): Promise<{ roomID: number }> {
  const existingRoom = await getChatRoomByName(name);
  if (existingRoom) {
    return existingRoom;
  }
  const result = await createChatRoom(ownerID, name);
  return { roomID: (result as any).lastID };
}

// Get room by ID
export const getChatRoomByID = (roomID: number) =>
  get<chatType.chatRooms>(`SELECT * FROM chatRooms WHERE roomID = ?`, [roomID]);

// Get all rooms for a user
export const getChatRoomsByOwner = (ownerID: number) =>
  getAll<chatType.chatRooms>(`SELECT * FROM chatRooms WHERE ownerID = ?`, [ownerID]);

// Delete chatroom by ID
export const deleteChatRoomByID = (roomID: number) =>
  run(
    `DELETE FROM chatRooms WHERE roomID = ?`,
    [roomID]
  );

// Get all the rooms that a user is in
export const getChatRoomsByUserId = (userID: number) =>
  getAll<chatType.chatRooms>(
    `
    SELECT r.*
    FROM chatRooms r
    JOIN chatRoomMembers m ON r.roomID = m.roomID
    WHERE m.userID = ?
    `,
    [userID]
  );

// ########################
// #     ROOM MEMBERS     #
// ########################
// Add a user to a room
export const createChatRoomMember = (roomID: number, userID: number) =>
  run(`INSERT OR IGNORE INTO chatRoomMembers (roomID, userID) VALUES (?, ?)`, [roomID, userID]);

// Get all members of a room
export const getChatRoomMembers = (roomID: number) =>
  getAll<chatType.chatRoomMembers>(`SELECT userID FROM chatRoomMembers WHERE roomID = ?`, [roomID]);

// Get all rooms for a given user
export const getChatRoomsForUser = (userID: number) =>
  getAll<chatType.chatRoomMembers>(`SELECT * FROM chatRoomMembers WHERE userID = ?`, [userID]);

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
  getAll<chatType.messages>(
    `SELECT * FROM messages WHERE roomID = ? ORDER BY created_at DESC LIMIT ?`,
    [roomID, limit]
  );

// Get messages by a specific user in a room
export const getMessagesByUserInChatRoom = (authorID: number, roomID: number) =>
  getAll<chatType.messages>(
    `SELECT * FROM messages WHERE roomID = ? AND authorID = ? ORDER BY created_at DESC`,
    [roomID, authorID]
  );

// ########################
// #       FRIENDS        #
// ########################
// Add a friend
export const addFriend = (userID: number, friendID: number) =>
  run(
    `INSERT OR IGNORE INTO user_relationships (user_id, related_user_id, type) VALUES (?, ?, 'friend')`,
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
  getAll<chatType.user_relationships>(
    `SELECT u.our_index, u.username FROM users u
     JOIN user_relationships r ON u.our_index = r.related_user_id
     WHERE r.user_id = ? AND r.type = 'friend'`,
    [userID]
  );

export const getAllUsersWhoHaveMeAsFriend = async (userID: number) => {
  const result = await getAll<chatType.user_relationships>(
    `SELECT user_id FROM user_relationships WHERE related_user_id = ? AND type = 'friend'`,
    [userID]
  );
  return result.map(row => row.userID); // returns number[]
};


// ########################
// #        BLOCKS        #
// ########################
export const blockUser = (userID: number, blockedID: number) =>
  run(
    `INSERT OR IGNORE INTO user_relationships (user_id, related_user_id, type) VALUES (?, ?, 'block')`,
    [userID, blockedID]
  );

// Unblock a user
export const unblockUser = (userID: number, blockedID: number) =>
  run(
    `DELETE FROM user_relationships WHERE user_id = ? AND related_user_id = ? AND type = 'block'`,
    [userID, blockedID]
  );


  export const isBlocked = async (userID: number, authorID: number): Promise<boolean> => {
    const result = await get<chatType.user_relationships>(
      `SELECT 1 FROM user_relationships WHERE user_id = ? AND related_user_id = ? AND type = 'block' LIMIT 1`,
      [userID, authorID]
    );
    return result !== null;
  };

// Get blocked users list for a user
export const getBlockedUsers = (userID: number) =>
  getAll<chatType.user_relationships>(
    `SELECT u.our_index, u.username FROM users u
     JOIN user_relationships r ON u.our_index = r.related_user_id
     WHERE r.user_id = ? AND r.type = 'block'`,
    [userID]
  );


// ########################
// #    Multi-db          #
// ########################

export const getCleanHistory = async (roomID: number, userID: number, limit: number = 50) => {
  return getAll<chatType.messages>(
    `
    SELECT m.*
    FROM messages m
    LEFT JOIN user_relationships r
      ON m.authorID = r.related_user_id
      AND r.user_id = ?
      AND r.type = 'block'
    WHERE m.roomID = ? AND r.id IS NULL
    ORDER BY m.created_at DESC
    LIMIT ?
    `,
    [userID, roomID, limit]
  );
};
