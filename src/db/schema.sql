
CREATE  TABLE IF NOT EXISTS users (
	our_index		INTEGER PRIMARY KEY AUTOINCREMENT,
	rand_id			TEXT NOT NULL,
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

			