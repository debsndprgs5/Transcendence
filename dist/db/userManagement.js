"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUser = exports.getToptbyIndex = exports.getRandbyIndex = exports.getPasswordHByIndex = exports.getUnameByIndex = exports.getIdByIndex = exports.getIndexByUname = exports.getUserByRand = exports.getUserByName = exports.setAvatarUrl = exports.setTotp = exports.setPasswordH = exports.setUserName = exports.setRandId = void 0;
exports.setDb = setDb;
exports.run = run;
exports.get = get;
exports.getAll = getAll;
let db;
function setDb(database) {
    db = database;
}
function run(query, params = []) {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) {
                console.error('Database error:', err);
                reject(err);
            }
            else {
                resolve({ lastID: this.lastID, changes: this.changes });
            }
        });
    });
}
function get(query, params = []) {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) {
                console.error('Database error:', err);
                reject(err);
            }
            else {
                resolve(row ?? null);
            }
        });
    });
}
function getAll(query, params = []) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                reject(err);
            }
            else {
                resolve(rows);
            }
        });
    });
}
// Setters
const setRandId = (index, randId) => run('UPDATE users SET rand_id = ? WHERE our_index = ?', [randId, index]);
exports.setRandId = setRandId;
const setUserName = (index, username) => run('UPDATE users SET username = ? WHERE our_index = ?', [username, index]);
exports.setUserName = setUserName;
const setPasswordH = (index, password) => run('UPDATE users SET password_hashed = ? WHERE our_index = ?', [password, index]);
exports.setPasswordH = setPasswordH;
const setTotp = (index, token) => run('UPDATE users SET totp_secret = ? WHERE our_index = ?', [token, index]);
exports.setTotp = setTotp;
const setAvatarUrl = (index, url) => run('UPDATE users SET avatar_url = ? WHERE our_index = ?', [url, index]);
exports.setAvatarUrl = setAvatarUrl;
// Getters
//I kept all the others because It could still be use but this is the only
// needed call this wil returns all as the interface declared in types/user and can be use 
// as user object
const getUserByName = (username) => get('SELECT * FROM users WHERE username = ?', [username])
    .then(row => row ?? null);
exports.getUserByName = getUserByName;
const getUserByRand = (username) => get('SELECT * FROM users WHERE rand_id = ?', [username])
    .then(row => row ?? null);
exports.getUserByRand = getUserByRand;
const getIndexByUname = (username) => get('SELECT our_index FROM users WHERE username = ?', [username])
    .then(row => row?.our_index ?? null);
exports.getIndexByUname = getIndexByUname;
const getIdByIndex = (index) => get('SELECT rand_id FROM users WHERE our_index = ?', [index]);
exports.getIdByIndex = getIdByIndex;
const getUnameByIndex = (index) => get('SELECT username FROM users WHERE our_index = ?', [index]);
exports.getUnameByIndex = getUnameByIndex;
const getPasswordHByIndex = (index) => get('SELECT password_hashed FROM users WHERE our_index = ?', [index]);
exports.getPasswordHByIndex = getPasswordHByIndex;
const getRandbyIndex = (index) => get('SELECT rand_id FROM users WHERE our_index = ?', [index]);
exports.getRandbyIndex = getRandbyIndex;
const getToptbyIndex = (index) => get('SELECT totp_secret FROM users WHERE our_index = ?', [index]);
exports.getToptbyIndex = getToptbyIndex;
// Create User
const createUser = (rand_id, username, password_hashed, totp_secret = null) => run(`INSERT INTO users (rand_id, username, password_hashed, totp_secret)
     VALUES (?, ?, ?, ?)`, [rand_id, username, password_hashed, totp_secret]);
exports.createUser = createUser;
