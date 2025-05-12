import sqlite3 from 'sqlite3';
import { user } from '../types/user';
const db = new sqlite3.Database('./src/db/userdata.db');

function run(query: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) {
        console.error('Database error:', err);  // Log the error for debugging purposes
        reject(err);  // Reject with error
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

function get(query: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) {
        console.error('Database error:', err);  // Log the error for debugging purposes
        reject(err);  // Reject with error
      } else {
        resolve(row);  // Resolve with the row
      }
    });
  });
}


// Setters
export const setRandId = (index: number, randId: string) =>
  run('UPDATE users SET rand_id = ? WHERE our_index = ?', [randId, index]);

export const setUserName = (index: number, username: string) =>
  run('UPDATE users SET username = ? WHERE our_index = ?', [username, index]);


export const setPasswordH = (index: number, password: string) =>
  run('UPDATE users SET password_hashed = ? WHERE our_index = ?', [password, index]);

export const setTotp = (index: number, token: string) =>
  run('UPDATE users SET totp_secret = ? WHERE our_index = ?', [token, index]);

// Getters
//I kept all the others because It could still be use but this is the only
// needed call this wil returns all as the interface declared in types/user and can be use 
// as user object
export const getUserByName = (username: string): Promise<user | null> =>
  get('SELECT * FROM users WHERE username = ?', [username])
    .then(row => row ?? null);


export const getUserByRand = (username: string): Promise<user | null> =>
  get('SELECT * FROM users WHERE rand_id = ?', [username])
    .then(row => row ?? null);

export const getIndexByUname = (username: string): Promise<number | null> =>
  get('SELECT our_index FROM users WHERE username = ?', [username])
    .then(row => row?.our_index ?? null);

export const getIdByIndex = (index: number) =>
  get('SELECT rand_id FROM users WHERE our_index = ?', [index]);

export const getUnameByIndex = (index: number) =>
  get('SELECT username FROM users WHERE our_index = ?', [index]);

export const getPasswordHByIndex = (index: number) =>
  get('SELECT password_hashed FROM users WHERE our_index = ?', [index]);

export const getRandbyIndex = (index: number) =>
  get('SELECT rand_id FROM users WHERE our_index = ?', [index]); 


export const getToptbyIndex = (index: number) =>
  get('SELECT totp_secret FROM users WHERE our_index = ?' , [index]);

// Create User
export const createUser = (rand_id: string, username: string, password_hashed: string, totp_secret: string | null = null) =>
  run(
    `INSERT INTO users (rand_id, username, password_hashed, totp_secret)
     VALUES (?, ?, ?, ?)`,
    [rand_id, username, password_hashed, totp_secret]
  );
