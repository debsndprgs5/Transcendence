
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
CREATE TABLE IF NOT EXISTS chatRooms (
  roomID      INTEGER PRIMARY KEY AUTOINCREMENT,
  ownerID     INTEGER NOT NULL,
  name        TEXT NOT NULL DEFAULT 'Room',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ownerID) REFERENCES users(our_index)
);


CREATE TABLE IF NOT EXISTS chatRoomMembers (
  roomID  INTEGER NOT NULL,
  userID  INTEGER NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- to check when a user as join
  FOREIGN KEY (roomID) REFERENCES chatRooms(roomID) ON DELETE CASCADE, -- auto delete when a user or the room is deleted
  FOREIGN KEY (userID) REFERENCES users(our_index) ON DELETE CASCADE,
  UNIQUE(roomID, userID)                                     -- One saving per pair
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

-- User relationships (friends and blocks)
CREATE TABLE user_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    related_user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('friend', 'block')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (related_user_id) REFERENCES users(id),
    UNIQUE(user_id, related_user_id, type)
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