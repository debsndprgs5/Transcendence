import sqlite3 from 'sqlite3';
import { user } from '../types/user';
import * as chatType from '../types/chat'
import {run, get, getAll} from 'userManagments'
const db = new sqlite3.Database('./src/db/userdata.db');
 
// ########################
// #         ROOMS        #
// ########################
// Create room
export const createChatRoom = (ownerID: number) =>
    run(`INSERT INTO chatRooms (ownerID) VALUES (?)`, [ownerID]);
  
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
    getAll(`SELECT roomID FROM chatRoomMembers WHERE userID = ?`, [userID]);
  
// ########################
// #       MESSAGES       #
// ########################
// Create message
export const createMessage = (roomID: number, authorID: number, content: string) =>
    run(`INSERT INTO messages (roomID, authorID, content) VALUES (?, ?, ?)`, [roomID, authorID, content]);
  
  // Get messages for a room (latest N)
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
  

