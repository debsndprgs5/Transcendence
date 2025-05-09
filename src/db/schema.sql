/*Here to test stuff  */

CREATE  TABLE IF NOT EXISTS users (
	id				INTEGER PRIMARY KEY AUTOINCREMENT,
	username		TEXT UNIQUE NOT NULL,
	email			TEXT NOT NULL,
	password_hashed	TEXT NOT NULL,
	totp_secret  	TEXT, --token
  	created_at   	DATETIME DEFAULT CURRENT_TIMESTAMP
);
/*
CREATE TABLE if not exist Matches (
	id		INTEGER PRIMARY KEY AUTOINCREMENT,
	win		INTEGER
);

CREATE TABLE Chat (

);
*/