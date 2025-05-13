import sqlite3 from 'sqlite3';
import { user } from '../types/user';
import * as chatType from '../types/chat'
import {run, get} from 'userManagments'
const db = new sqlite3.Database('./src/db/userdata.db');
 
// ########################
// #         ROOMS        #
// ########################
// Create
export const createRoom = (userID:number) =>
  run(
    `INSERT INTO rooms (ownerID)
     VALUES (?)`,
    [userID]
  );
// Set

// Get


// ########################
// #     ROOM MEMBERS     #
// ########################
// Create
export const createRoomMember = (roomID:number, userID:number) =>
    run(
        `INSERT INTO roomMembers (roomID, userID)
         VALUES (?, ?)`,
        [roomID, userID]
      );  
// Set

// Get

// ########################
// #       MESSAGES       #
// ########################
// Create
export const createMessage = (roomID:number, authorID:number, content:string) =>
    run(
        `INSERT INTO message (roomID, authorID, content)
         VALUES (?, ?, ?)`,
        [roomID, authorID, content]
      ); 
// Set

// Get

