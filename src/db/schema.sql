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
  "name"       TEXT    NOT NULL DEFAULT 'Room',
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
  "type"             TEXT    NOT NULL CHECK(type IN ('friend','block')),
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id)         REFERENCES users(our_index) ON DELETE CASCADE,
  FOREIGN KEY(related_user_id) REFERENCES users(our_index) ON DELETE CASCADE,
  UNIQUE(user_id, related_user_id, type)
);


CREATE TABLE IF NOT EXISTS gameRooms(
	gameID 						INTEGER PRIMARY KEY AUTOINCREMENT,
 	"name" 						TEXT,
	tournamentID 				INTEGER,
 	gameType					TEXT, -- public | private 
 	"state"						TEXT, -- waiting| playing
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

--  Main Tournament table
CREATE TABLE IF NOT EXISTS tournaments (
  tournamentID   INTEGER PRIMARY KEY AUTOINCREMENT,
  "name"         TEXT    NOT NULL,
  createdBy      INTEGER NOT NULL,  -- owner userID
  playersCount   INTEGER ,  -- players in tournament
  "status"       TEXT    NOT NULL,  -- 'waiting' | 'playing' | 'closed'
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  paddle_speed 	 INTEGER NOT NULL,
  ball_speed 	   INTEGER NOT NULL,
  "limit" 		   INTEGER NOT NULL,
  chatID         INTEGER NOT NULL,
  FOREIGN KEY(createdBy) REFERENCES users(our_index),
  FOREIGN KEY (chatID) REFERENCES chatRooms(roomID)
);

--  Register tournament players
CREATE TABLE IF NOT EXISTS tournamentMembers (
  tournamentID   INTEGER NOT NULL,
  userID         INTEGER NOT NULL,
  points         INTEGER DEFAULT 0,          -- victory = 10 pts, defeat = 0pts, even = 5 pts
  matchesPlayed  INTEGER DEFAULT 0,
  PRIMARY KEY (tournamentID, userID),
  FOREIGN KEY(tournamentID) REFERENCES tournaments(tournamentID) ON DELETE CASCADE,
  FOREIGN KEY(userID) REFERENCES users(our_index) ON DELETE CASCADE
);

--  Matches results
CREATE TABLE IF NOT EXISTS tournamentMatches (
  matchID        INTEGER NOT NULL,
  tournamentID   INTEGER NOT NULL,
  playerA        INTEGER NOT NULL,
  playerB        INTEGER NOT NULL,
  scoreA         INTEGER NOT NULL,
  scoreB         INTEGER NOT NULL,
  played_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (matchID) REFERENCES gameRooms(gameID) ON DELETE CASCADE,
  FOREIGN KEY(tournamentID) REFERENCES tournaments(tournamentID) ON DELETE CASCADE,
  FOREIGN KEY(playerA) REFERENCES users(our_index) ON DELETE CASCADE,
  FOREIGN KEY(playerB) REFERENCES users(our_index) ON DELETE CASCADE
);

--  Normal Matches results 4 players
CREATE TABLE IF NOT EXISTS gameResultFour (
  matchID		INTEGER NOT NULL,
  winner		INTEGER NOT NULL,
  playerA		INTEGER NOT NULL,
  playerB		INTEGER NOT NULL,
  playerC		INTEGER NOT NULL,
  playerD		INTEGER NOT NULL,
  scoreA		INTEGER NOT NULL,
  scoreB		INTEGER NOT NULL,
  scoreC		INTEGER NOT NULL,
  scoreD		INTEGER NOT NULL,
  played_at		DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(winner) REFERENCES users(our_index) ON DELETE CASCADE,
  FOREIGN KEY(playerA) REFERENCES users(our_index) ON DELETE CASCADE,
  FOREIGN KEY(playerB) REFERENCES users(our_index) ON DELETE CASCADE,
  FOREIGN KEY(playerC) REFERENCES users(our_index) ON DELETE CASCADE,
  FOREIGN KEY(playerD) REFERENCES users(our_index) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_preferences (
    userID INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    -- Camera
    camera_mode TEXT DEFAULT '3D',
    camera_angle REAL DEFAULT 0,
    camera_focus TEXT DEFAULT 'center',
    camera_pos_x REAL DEFAULT -50,
    camera_pos_y REAL DEFAULT 50,
    camera_pos_z REAL DEFAULT 0,

    -- Lighting
    light_intensity REAL DEFAULT 1.0,

    --Player Paddle
    paddle_color TEXT DEFAULT '#00ff00',
    paddle_texture TEXT,
    paddle_material TEXT DEFAULT 'default',
    --Opponent Paddle
    op_paddle_color TEXT DEFAULT '#ff0000',
    op_paddle_texture TEXT,
    op_paddle_material TEXT DEFAULT 'default',
    -- Ball
    ball_color TEXT DEFAULT '#ffffff',
    ball_texture TEXT,
    ball_material TEXT DEFAULT 'default',
    ball_trail_enabled INTEGER DEFAULT 0,

    -- Walls
    wall_color TEXT DEFAULT '#999999',
    wall_texture TEXT,
    wall_material TEXT DEFAULT 'default',

    -- Sound
    sound_wall_bounce INTEGER DEFAULT 1,
    sound_paddle_bounce INTEGER DEFAULT 1,
    sound_point_win TEXT DEFAULT 'default_win.wav',
    sound_point_lose TEXT DEFAULT 'default_lose.wav',

    -- UI & Avatar
    avatar_enabled INTEGER DEFAULT 1,
    avatar_follow_paddle INTEGER DEFAULT 0,
    avatar_offset REAL DEFAULT 0.5,
    avatar_size REAL DEFAULT 1.0,
    ui_font TEXT DEFAULT 'Roboto',
    ui_font_size INTEGER DEFAULT 16,
    ui_font_color TEXT DEFAULT '#ffffff',
    ui_scale REAL DEFAULT 1.0,
    ui_score_position TEXT DEFAULT 'top-center',
    ui_name_position TEXT DEFAULT 'above-paddle'
);

------------------- STATS -------------------
CREATE TABLE IF NOT EXISTS scoreTable (
  matchID       INTEGER,
  userID        INTEGER,
  score         INTEGER,
  result        INTEGER, -- 1 = win, 0 = lose, 2 = draw
  FOREIGN KEY (matchID) REFERENCES matchHistory(matchID),
  FOREIGN KEY (userID) REFERENCES users(our_index)
);

CREATE TABLE IF NOT EXISTS matchHistory (
  matchID           INTEGER,
  tourID            INTEGER,
  rulesPaddleSpeed  INTEGER,
  rulesBallSpeed    INTEGER,
  rulesLimit        INTEGER,
  rulesCondition    INTEGER, -- 1 = score, 0 = time
  started_at        DATETIME DEFAULT CURRENT_TIMESTAMP, -- date et heure de début du match
  duration          INTEGER -- durée du match en secondes
);

-- -- Données de test pour scoreTable (matchs entre userId 1 et 2)
-- INSERT INTO scoreTable (matchID, userID, score, result) VALUES
--   (1, 1, 10, 1), (1, 2, 5, 0),
--   (2, 1, 7, 0),  (2, 2, 11, 1),
--   (3, 1, 8, 0),  (3, 2, 12, 1),
--   (4, 1, 15, 1), (4, 2, 3, 0),
--   (5, 1, 6, 0),  (5, 2, 9, 1),
--   (6, 1, 13, 1), (6, 2, 7, 0),
--   (7, 1, 4, 0),  (7, 2, 16, 1),
--   (8, 1, 12, 1), (8, 2, 8, 0),
--   (9, 1, 10, 2), (9, 2, 10, 2),
--   (10, 1, 14, 1), (10, 2, 6, 0),
--   (11, 1, 9, 0),  (11, 2, 11, 1),
--   (12, 1, 5, 0),  (12, 2, 15, 1),
--   (13, 1, 11, 1), (13, 2, 9, 0),
--   (14, 1, 8, 0),  (14, 2, 12, 1),
--   (15, 1, 10, 2), (15, 2, 10, 2),
--   (16, 1, 14, 1), (16, 2, 6, 0),
--   (17, 1, 9, 0),  (17, 2, 11, 1),
--   (18, 1, 5, 0),  (18, 2, 15, 1),
--   (19, 1, 11, 1), (19, 2, 9, 0),
--   (20, 1, 8, 0),  (20, 2, 12, 1),
--   (21, 1, 10, 2), (21, 2, 10, 2),
--   (22, 1, 14, 1), (22, 2, 6, 0),
--   (23, 1, 9, 0),  (23, 2, 11, 1),
--   (24, 1, 5, 0),  (24, 2, 15, 1),
--   (25, 1, 11, 1), (25, 2, 9, 0),
--   (26, 1, 8, 0),  (26, 2, 12, 1),
--   (27, 1, 10, 2), (27, 2, 10, 2),
--   (28, 1, 14, 1), (28, 2, 6, 0),
--   (29, 1, 9, 0),  (29, 2, 11, 1),
--   (30, 1, 5, 0),  (30, 2, 15, 1),
--   (31, 1, 11, 1), (31, 2, 9, 0),
--   (32, 1, 8, 0),  (32, 2, 12, 1),
--   (33, 1, 10, 2), (33, 2, 10, 2),
--   (34, 1, 14, 1), (34, 2, 6, 0),
--   (35, 1, 9, 0),  (35, 2, 11, 1);

-- -- userID 1 : 13 victoires
-- -- userID 2 : 17 victoires
-- -- Egalités : 5

-- INSERT INTO scoreTable (matchID, userID, score, result) VALUES
--   (1, 1, 10, 1), (1, 2, 5, 0), (1, 3, 5, 0), (1, 4, 10, 1),
--   (2, 1, 7, 0),  (2, 2, 11, 1), (2, 3, 7, 0), (2, 4, 11, 1);


-- INSERT INTO scoreTable (matchID, userID, score, result) VALUES
--   (3, 1, 8, 1),  (3, 3, 3, 0),
--   (4, 1, 6, 0),  (4, 4, 14, 1),
--   (5, 1, 100, 2), (5, 2, 100, 2);
  