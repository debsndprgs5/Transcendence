
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
 	name 						TEXT,
	tournamentID 				INTEGER,
 	gameType					TEXT, -- public | private 
 	state						TEXT, -- waiting| playing
	mode 						TEXT,
	rules						TEXT,
	createdBy					INTEGER,
	created_at 					DATETIME DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY(tournamentID)	REFERENCES tournaments(tournamentID) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS gameMembers(
	gameID 						INTEGER,
	tournamentID 				INTEGER,
	userID 						INTEGER,
	alias 						TEXT,
	created_at 					DATETIME DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY(gameID) 		REFERENCES gameRooms(gameID) ON DELETE CASCADE,
	FOREIGN KEY(userID)			REFERENCES users(our_index) ON DELETE CASCADE,
	FOREIGN KEY(tournamentID) 	REFERENCES tournaments(tournamentID) ON DELETE CASCADE
);

-- 1. Main Tournament table
CREATE TABLE IF NOT EXISTS tournaments (
  tournamentID   INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT    NOT NULL,
  createdBy      INTEGER NOT NULL,  -- owner userID
  maxPlayers     INTEGER NOT NULL,  -- max players in tournament
  status         TEXT    NOT NULL,  -- 'open' | 'ongoing' | 'finished'
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(createdBy) REFERENCES users(our_index)
);

-- 2. Register tournament players
CREATE TABLE IF NOT EXISTS tournamentMembers (
  tournamentID   INTEGER NOT NULL,
  userID         INTEGER NOT NULL,
  points         INTEGER DEFAULT 0,          -- victory = 10 pts, defeat = 0pts, even = 5 pts
  matchesPlayed  INTEGER DEFAULT 0,
  PRIMARY KEY (tournamentID, userID),
  FOREIGN KEY(tournamentID) REFERENCES tournaments(tournamentID) ON DELETE CASCADE,
  FOREIGN KEY(userID) REFERENCES users(our_index) ON DELETE CASCADE
);

-- 3. Matches results
CREATE TABLE IF NOT EXISTS tournamentMatches (
  matchID        INTEGER PRIMARY KEY AUTOINCREMENT,
  tournamentID   INTEGER NOT NULL,
  playerA        INTEGER NOT NULL,
  playerB        INTEGER NOT NULL,
  scoreA         INTEGER NOT NULL,
  scoreB         INTEGER NOT NULL,
  played_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tournamentID) REFERENCES tournaments(tournamentID) ON DELETE CASCADE,
  FOREIGN KEY(playerA) REFERENCES users(our_index) ON DELETE CASCADE,
  FOREIGN KEY(playerB) REFERENCES users(our_index) ON DELETE CASCADE
);

