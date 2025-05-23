
CREATE TABLE IF NOT EXISTS users (
  our_index       INTEGER PRIMARY KEY AUTOINCREMENT,
  rand_id         TEXT    NOT NULL,
  username        TEXT    UNIQUE NOT NULL,
  password_hashed TEXT    NOT NULL,
  totp_secret     TEXT,
  totp_pending    TEXT    DEFAULT NULL,
  jwtToken        TEXT,
  avatar_url      TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 0 => general , no groups no owner send to all 
CREATE TABLE IF NOT EXISTS chatRooms (
  roomID     INTEGER PRIMARY KEY AUTOINCREMENT,
  ownerID    INTEGER NOT NULL,
  name       TEXT    NOT NULL DEFAULT 'Room',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(ownerID) REFERENCES users(our_index) ON DELETE CASCADE
);

-- Rooms members
CREATE TABLE IF NOT EXISTS chatRoomMembers (
  roomID    INTEGER NOT NULL,
  userID    INTEGER NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (roomID, userID),
  FOREIGN KEY(roomID) REFERENCES chatRooms(roomID) ON DELETE CASCADE,
  FOREIGN KEY(userID) REFERENCES users(our_index)  ON DELETE CASCADE
);

--All messages send trough app 
CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  roomID     INTEGER NOT NULL,
  authorID   INTEGER NOT NULL,
  content    TEXT    NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(roomID)   REFERENCES chatRooms(roomID) ON DELETE CASCADE,
  FOREIGN KEY(authorID) REFERENCES users(our_index)  ON DELETE CASCADE
);

-- User relationships (friends and blocks)
CREATE TABLE IF NOT EXISTS user_relationships (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL,
  related_user_id  INTEGER NOT NULL,
  type             TEXT    NOT NULL CHECK(type IN ('friend','block')),
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id)         REFERENCES users(our_index) ON DELETE CASCADE,
  FOREIGN KEY(related_user_id) REFERENCES users(our_index) ON DELETE CASCADE,
  UNIQUE(user_id, related_user_id, type)
);


CREATE TABLE IF NOT EXISTS gameRooms(
	gameID 						INTEGER PRIMARY KEY AUTOINCREMENT,
	tournamentID 				INTEGER,
	mode 						TEXT,
	rules						TEXT,
	created_at 					DATETIME DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY(tournamentID)	REFERENCES tournaments(tournamentID) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS gameMembers(
	gameID 						INTEGER,
	tournamentID 				INTEGER,
	userID 						INTEGER,
	alias 						TEXT,
	FOREIGN KEY(gameID) 		REFERENCES gameRooms(gameID) ON DELETE CASCADE,
	FOREIGN KEY(userID)			REFERENCES users(our_index) ON DELETE CASCADE,
	FOREIGN KEY(tournamentID) 	REFERENCES tournaments(tournamentID) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS tournaments(
	tournamentID 	INTEGER PRIMARY KEY AUTOINCREMENT,
	round			INTEGER,
	players_data 	TEXT --JSON string to keep tracks of all present and future matches
);



CREATE TABLE IF NOT EXISTS userStats(
	gameID							INTEGER,
	userID 							INTEGER,
	mode							TEXT, --'tournament'|'1v1_invite'|'1v1_random'
	result	 						TEXT, -- 'winner'|'loser'|'1st'/'2nd'....
	score							TEXT, -- JSON {user:userID, opponent1: opponant1ID, ...}
	gameDuration					INTEGER, --in seconds ?
	datas							TEXT, -- big JSON string not for now
	created_at 						DATETIME DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY(tournamentID) 		REFERENCES tournaments(tournamentID) ON DELETE CASCADE,
	FOREIGN KEY(userID) 			REFERENCES users(our_index) ON DELETE CASCADE
);



--Adding the GD(GeneralDummy) -> he owns the general chat at 0
INSERT OR IGNORE INTO users(our_index, rand_id, username, password_hashed)
VALUES (0, '0', 'GeneralDummy', '0');

INSERT OR IGNORE INTO chatRooms(roomID, ownerID)
VALUES (0, 0);

	