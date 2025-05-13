
CREATE  TABLE IF NOT EXISTS users (
	our_index		INTEGER PRIMARY KEY AUTOINCREMENT,
	rand_id			TEXT NOT NULL,
	username		TEXT UNIQUE NOT NULL,
	password_hashed	TEXT NOT NULL,
	totp_secret  	TEXT,
	jwtToken		TEXT,
  	created_at   	DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 0 => general , no groups no owner send to all 
CREATE TABLE IF NOT EXISTS chatRooms(
	roomID		INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	ownerID		INTEGER NOT NULL,
);

--Keep tracks of who is where, one can be everywhere
CREATE TABLE IF NOT EXISTS chatRoomMembers(
	roomID		INTEGER NOT NULL,
	userID 		INTEGER NOT NULL,
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

--Adding the GD(GeneralDummy) -> he owns the general chat at 0
INSERT OR IGNORE into users(our_index, rand_id, username, password_hashed,)(0,0,"GeneralDummy",0);
INSERT OR IGNORE into rooms(roomID, ownerID)(0,0);
INSERT OR IGNORE int messages(roomID, ownerID, content)(0,0,"Welcome on our amazing chat");
/*
Still needs at least 

Friends and block list 

Game/render

*/			