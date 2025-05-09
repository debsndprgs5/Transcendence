import { FastifyInstance } from 'fastify';

import sqlite3 from 'sqlite3';

sqlite3.verbose();

const db = new sqlite3.Database('./userdata.db', (err) => {
  if (err) {
    console.error('Failed to connect to the database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

export default fp(async function (fastify: FastifyInstance) {
  fastify.decorate('db', db);

  fastify.addHook('onClose', (instance, done) => {
    db.close(done);
  });
});

// Get user by username
export function getUserByName(name: string): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE username = ?', [name], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

// Add a new user
export function addUser(name: string, email: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const query = 'INSERT INTO users (username, email) VALUES (?, ?)';
    db.run(query, [name, email], function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID });  // Return the id of the new user
    });
  });
}

// Set password for a user
export function setPassword(id: number, password: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const query = 'UPDATE users SET password_hashed = ? WHERE id = ?';
    db.run(query, [password, id], function (err) {
      if (err) return reject(err);
      resolve({ changes: this.changes });  // Return number of rows affected (useful for checking if it updated)
    });
  });
}

// Set the token for a user
export function setToken(id: number, token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const query = 'UPDATE users SET totp_secret = ? WHERE id = ?';
    db.run(query, [token, id], function (err) {
      if (err) return reject(err);
      resolve({ changes: this.changes });  // Return number of rows affected
    });
  });
}

// Example function - Get the date from the user's creation time by their username
export function getDateFromName(name: string): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get('SELECT created_at FROM users WHERE username = ?', [name], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

// Get user ID by username
export function getIdByName(name: string): Promise<number | null> {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM users WHERE username = ?', [name], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);  // If no user is found, return null
      resolve(row.id);  // Return the ID of the user
    });
  });
}