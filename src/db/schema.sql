
CREATE  TABLE IF NOT EXISTS users (
	our_index		INTEGER PRIMARY KEY AUTOINCREMENT,
	rand_id			TEXT NOT NULL,
	username		TEXT UNIQUE NOT NULL,
	password_hashed	TEXT NOT NULL,
	totp_secret  	TEXT, --token
  	created_at   	DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 0 => general , no groups no owner send to all 
CREATE TABLE IF NOT EXISTS rooms(
	roomID		INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	ownerID		INTEGER,
);

--Keep tracks of who is where, one can be everywhere
CREATE TABLE IF NOT EXISTS roomMembers(
	roomID		INTEGER,
	userID 		INTEGER,
	FOREIGN KEY(roomID) REFERENCES rooms(roomID)
);

--All messages send trough app 
CREATE TABLE IF NOT EXISTS messages (
	roomID 			INTEGER,
	authorID		INTEGER,
	content			TEXT,
	created_at		DATETIME DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (roomID) REFERENCES rooms(roomID),
	FOREIGN KEY (authorID) REFERENCES users(our_index)
);



/*
Still needs at least 

Friends and block list 

Game/render

*/			