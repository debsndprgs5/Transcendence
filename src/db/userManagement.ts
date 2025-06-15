import { FastifyInstance } from 'fastify';
import sqlite3 from 'sqlite3';
import { user } from '../types/user';

let db: sqlite3.Database;

export function setDb(database: sqlite3.Database) {
  db = database;
}

function run(query: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err: Error | null) {
      if (err) {
        console.error('Database error:', err);
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

function get<T>(query: string, params: any[] = []): Promise<T | null> {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err: Error | null, row: T | undefined) => {
      if (err) {
        console.error('Database error:', err);
        reject(err);
      } else {
        resolve(row ?? null);
      }
    });
  });
}

function getAll<T>(query: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err: Error | null, rows: T[]) => {
      if (err) {
        console.error('Database error:', err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

export { run, get, getAll };



// Setters
export const setRandId = (index: number, randId: string) =>
  run('UPDATE users SET rand_id = ? WHERE our_index = ?', [randId, index]);

export const setUserName = (index: number, username: string) =>
  run('UPDATE users SET username = ? WHERE our_index = ?', [username, index]);


export const setPasswordH = (index: number, password: string) =>
  run('UPDATE users SET password_hashed = ? WHERE our_index = ?', [password, index]);

export const setTotp = (index: number, token: string) =>
  run('UPDATE users SET totp_secret = ? WHERE our_index = ?', [token, index]);

export const setTotpPending = (index: number, token: string | null) =>
  run('UPDATE users SET totp_pending = ? WHERE our_index = ?', [token, index]);

export const setAvatarUrl = (index: number, url: string) =>
  run('UPDATE users SET avatar_url = ? WHERE our_index = ?', [url, index]);

// Getters
//I kept all the others because It could still be use but this is the only
// needed call this wil returns all as the interface declared in types/user and can be use 
// as user object


export const getUserByName = (username: string): Promise<user | null> =>
  get<user>('SELECT * FROM users WHERE username = ?', [username])
    .then(row => row ?? null);

export const getAvatarUrl = (username: string) =>
  get<user>('SELECT avatar_url FROM users WHERE username = ?', [username])

export const getUserByRand = (username: string): Promise<user | null> =>
  get<user>('SELECT * FROM users WHERE rand_id = ?', [username])
    .then(row => row ?? null);

export const getIndexByUname = (username: string): Promise<number | null> =>
  get<user>('SELECT our_index FROM users WHERE username = ?', [username])
    .then(row => row?.our_index ?? null);

export const getIdByIndex = (index: number) =>
  get<user>('SELECT rand_id FROM users WHERE our_index = ?', [index]);

export const getUnameByIndex = (index: number) =>
  get<user>('SELECT username FROM users WHERE our_index = ?', [index]);

export const getPasswordHByIndex = (index: number) =>
  get<user>('SELECT password_hashed FROM users WHERE our_index = ?', [index]);

export const getRandbyIndex = (index: number) =>
  get<user>('SELECT rand_id FROM users WHERE our_index = ?', [index]); 


export const getToptbyIndex = (index: number) =>
  get<user>('SELECT totp_secret FROM users WHERE our_index = ?' , [index]);

export const getTotpPendingByIndex = (index: number) =>
  get<user>('SELECT totp_pending FROM users WHERE our_index = ?', [index]);

// Create User
export const createUser = (rand_id: string, username: string, password_hashed: string, totp_secret: string | null = null) =>
  run(
    `INSERT INTO users (rand_id, username, password_hashed, totp_secret)
     VALUES (?, ?, ?, ?)`,
    [rand_id, username, password_hashed, totp_secret]
  );
