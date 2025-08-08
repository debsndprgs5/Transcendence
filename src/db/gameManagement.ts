import { randomInt } from 'crypto';
import sqlite3 from 'sqlite3';
import { user } from '../types/user';
import * as chatType from '../types/chat';
import { PreferencesRow } from '../shared/gameTypes'
import { run, get, getAll } from './userManagement';
import { getPlayerByUserID } from '../websockets/game.socket';
import * as Stats from './Stats';

// ########################
// #       GAME ROOMS     #
// ########################

// Create game room and return gameID
export const createGameRoom = async (
	type: string,
	state: string,
	mode: string,
	rules: string,
	name: string,
	userID: number,
	tournamentID: number | null = null
): Promise<number> => {
	const result = await run(
		`INSERT INTO gameRooms (gameType, state, mode, rules, name, createdBy, tournamentID)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[type, state, mode, rules, name, userID, tournamentID]
	);
	return result.lastID;
};

// Delete game room by ID
export const deleteGameRoom = (gameID: number) =>
	run(`DELETE FROM gameRooms WHERE gameID = ?`, [gameID]);

// Get a single game room by ID
export const getGameRoom = (gameID: number) =>
	get<{ gameID: number; mode: string; rules: string; tournamentID: number | null }>(
		`SELECT * FROM gameRooms WHERE gameID = ?`,
		[gameID]
	);

// Get all public waiting game rooms
export const getAllPublicGames = () =>
	getAll<{ gameID: number; name: string; mode: string; createdBy: number}>(
		`SELECT gameID, name, mode, createdBy FROM gameRooms WHERE gameType = 'public' AND state = 'waiting'`
	);

//get mode for gameID
export const getModePerGameID = (gameID:number) =>
  get<{mode:string}>(
    `SELECT mode FROM gameRooms WHERE gameID = ?`, [gameID]);

//get name for gameID
export const getNamePerGameID = (gameID:number) => 
	get<{name:string}>(
		`SELECT name FROM gameRooms WHERE gameID=?`, [gameID]
	);
export const setStateforGameID = (gameID:number, state:string)=>
  run(`UPDATE gameRooms SET state = ? where gameID = ?`, [state, gameID])

export async function getModeAndRulesForGameID(gameID: number) {
  const row = await get<{ mode: string; rules: string }>(
    `SELECT mode, rules FROM gameRooms WHERE gameID = ?`,
    [gameID]
  );
  if (!row) return null;
  try {
    return {
      mode: row.mode,
      rules: JSON.parse(row.rules),
    };
  } catch (err) {
    console.error(`[getModeAndRulesForGameID] JSON parse error for gameID ${gameID}:`, err);
    return null;
  }
}
// ########################
// #    GAME MEMBERS      #
// ########################

export const addMemberToGameRoom = (gameID: number, userID: number,  tournamentID: number | null = null) =>
	run(
		`INSERT INTO gameMembers (gameID, userID, tournamentID) VALUES (?, ?,  ?)`,
		[gameID, userID, tournamentID]
	);

export const delMemberFromGameRoom = (gameID: number, userID: number) =>
	run(`DELETE FROM gameMembers WHERE gameID = ? AND userID = ?`, [gameID, userID]);

export const getAllMembersFromGameRoom = (gameID: number) =>
 getAll<{ username: string , userID:number }>(
		`SELECT u.username, u.our_index
		 FROM gameMembers gm
		 JOIN users u ON gm.userID = u.our_index
		 WHERE gm.gameID = ?`,
		[gameID]
	);


export const getLastAddedToRoom = (gameID:number) =>
	get<{userID:number}>(
		`SELECT userID
		FROM gameMembers
		WHERE gameID = ?
		ORDER BY created_at DESC
		LIMIT 1`,
		[gameID]
	);

// ########################
// #     TOURNAMENTS      #
// ########################

export const createTournament = (
	name: string,
	createdBy: number,
	playersCount: number,
	status: string,
	paddle_speed:number,
	ball_speed:number,
	limit:number,
	chatID:number
) => {
	return run(
		`INSERT INTO tournaments (name, createdBy, playersCount, status, paddle_speed, ball_speed, "limit", chatID)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[name, createdBy, playersCount, status, paddle_speed, ball_speed, limit, chatID]
	);
};


export const setStateforTourID = (tournamentID:number, state:string)=>
  run(`UPDATE tournaments SET status = ? where tournamentID = ?`, [state, tournamentID])



export const delTournament = (tournamentID: number) =>
	run(`DELETE FROM tournaments WHERE tournamentID = ?`, [tournamentID]);

export const getTournamentById = (tournamentID: number) =>
	get<{	tournamentID: number;
			name: string;
			createdBy: number;
			playersCount: number;
			status: string;
			created_at: string;
			paddle_speed: number;
			ball_speed: number;
			limit: number
		}>(
		`SELECT * FROM tournaments WHERE tournamentID = ?`,
		[tournamentID]
	);

export const getAllTournaments = () =>
	getAll<{ tournamentID: number; name: string; createdBy: number; playersCount: number; status: string }>(
		`SELECT tournamentID, name, createdBy, playersCount, status FROM tournaments WHERE status='waiting'`
	);

export const addMemberToTournament = async (tournamentID: number, userID: number) => {
	await run(
		`INSERT OR IGNORE INTO tournamentMembers (tournamentID, userID, points, matchesPlayed)
		 VALUES (?, ?, 0, 0)`,
		[tournamentID, userID]
	);
	await run(
		`UPDATE tournaments SET playersCount = playersCount + 1 WHERE tournamentID = ?`,
		[tournamentID]
	);
};

export const delMemberFromTournament = async (tournamentID: number, userID: number) => {
	await run(
		`DELETE FROM tournamentMembers WHERE tournamentID = ? AND userID = ?`,
		[tournamentID, userID]
	);
	await run(
		`UPDATE tournaments SET playersCount = playersCount - 1 WHERE tournamentID = ?`,
		[tournamentID]
	);
};

export const getRulesForTourID = (tournamentID:number) =>
	getAll<{paddle_speed:number; ball_speed:number; limit:number; win_condition:'time'}>(
		`SELECT paddle_speed, ball_speed, "limit"
		 FROM tournaments
		 WHERE tournamentID = ?`,
		 [tournamentID]
	);

// Get all members from a tournament
export const getAllTournamentMembers = (tournamentID: number) =>
	getAll<{ userID: number; points: number; matchesPlayed: number }>(
		`SELECT userID, points, matchesPlayed
		 FROM tournamentMembers
		 WHERE tournamentID = ?`,
		[tournamentID]
	);

export const getOlderPlayerForTour = (userID:number, tourID:number) =>
		get<{ userID: number }>(
		`SELECT userID
		 FROM tournamentMembers
		 WHERE userID != ? AND tournamentID = ?
		 ORDER BY created_at ASC
		 LIMIT 1`,
		[userID, tourID]
	);
// Update tournament member's stats
export const updateMemberStats = (
	tournamentID: number,
	userID: number,
	points: number,
	matchesPlayed: number
) =>
	run(
		`UPDATE tournamentMembers
		 SET points = ?, matchesPlayed = ?
		 WHERE tournamentID = ? AND userID = ?`,
		[points, matchesPlayed, tournamentID, userID]
	);

// register a match's results
export const createMatchResult = (
	tournamentID: number,
	playerA: number,
	playerB: number,
	scoreA: number,
	scoreB: number
) =>
	run(
		`INSERT INTO tournamentMatches (tournamentID, playerA, playerB, scoreA, scoreB)
		 VALUES (?, ?, ?, ?, ?)`,
		[tournamentID, playerA, playerB, scoreA, scoreB]
	);

// List all played matches of a tournament
export const getAllMatches = (tournamentID: number) =>
	getAll<{ matchID: number; playerA: number; playerB: number; scoreA: number; scoreB: number; played_at: string }>(
		`SELECT matchID, playerA, playerB, scoreA, scoreB, played_at
		 FROM tournamentMatches
		 WHERE tournamentID = ?`,
		[tournamentID]
	);


export const getChatIDbyTourID = (tournamentID:number) =>
	get<{chatID:number}>(
		`SELECT chatID FROM tournaments WHERE tournamentID = ?`,
	[tournamentID]
);


// ############################
// #       Match Result       #
// ############################

export const saveMatchStats = async (
  matchID: number,
  tourID: number | null,
  paddleSpeed: number,
  ballSpeed: number,
  limit: number,
  winCondition: string,
  players: Array<{ userID: number, score: number, result: number }>,
  duration?: number,
  fromFuzzer = false
) => {
  try {
    // English: Upsert header; if a stub exists (created by bounce logging), update it.
    await run(
      `INSERT INTO matchHistory
         (matchID, tourID, rulesPaddleSpeed, rulesBallSpeed, rulesLimit, rulesCondition, duration)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(matchID) DO UPDATE SET
         tourID           = excluded.tourID,
         rulesPaddleSpeed = excluded.rulesPaddleSpeed,
         rulesBallSpeed   = excluded.rulesBallSpeed,
         rulesLimit       = excluded.rulesLimit,
         rulesCondition   = excluded.rulesCondition,
         duration         = excluded.duration`,
      [
        matchID,
        tourID ?? null,
        paddleSpeed,
        ballSpeed,
        limit,
        winCondition === 'score' ? 1 : 0,
        typeof duration === 'number' ? duration : null
      ]
    );

    // English: bulk upsert scores; guarantees one row per player per match
    const placeholders = players.map(() => '(?, ?, ?, ?)').join(',');
    const values = players.flatMap(p => [matchID, p.userID, p.score, p.result]);

    await run(
      `INSERT INTO scoreTable (matchID, userID, score, result)
       VALUES ${placeholders}
       ON CONFLICT(matchID, userID) DO UPDATE SET
         score  = excluded.score,
         result = excluded.result`,
      values
    );
  } catch (err) {
    console.error('[saveMatchStats] failed:', err);
    throw err; // ok to bubble at end of match; no game loop risk here
  }

  if (fromFuzzer) return;

  // Push fresh stats to each player (best effort)
  for (const p of players) {
    try {
      const playerSocket = getPlayerByUserID(p.userID);
      if (playerSocket?.typedSocket) {
        playerSocket.typedSocket.send('statsResult', await getStatsForUser(p.userID));
      }
    } catch (err) {
      console.warn('[saveMatchStats] Could not push stats to user', p.userID, err);
    }
  }
};

export const sendGameResultTwo = (gameID: number, userID: [number, number], winner: number, score: [number, number], start: string) =>
	run(
		`INSERT INTO gameResultTwo (gameID, winner, playerA, playerB, scoreA, scoreB, started_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[gameID, winner, userID[0], userID[1], score[0], score[1], start]
	);

export const sendGameResultFour = (gameID: number, userID: [number, number, number, number], winner: number, score: [number, number, number, number], start: string) =>
	run(
		`INSERT INTO gameResultFour (gameID, winner, playerA, playerB, playerC, playerD, scoreA, scoreB, scoreC, scoreD, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[gameID, winner, userID[0], userID[1], userID[2], userID[3], score[0], score[1], score[2], score[3], start]
	);

export const createDefaultPref = async (userID: number) => {
	await run(`INSERT INTO user_preferences (userID) VALUES (?)`, [userID]);
};

export const getAllPref = (userID: number): Promise<PreferencesRow | null> => {
	return get<PreferencesRow>(
		`SELECT * FROM user_preferences WHERE userID = ?`,
		[userID]
	)
}

export const setAllPref = async (userID: number, data: Partial<PreferencesRow>) => {
	if (Object.keys(data).length === 0) return;

	const fields = Object.keys(data);
	const values = Object.values(data);
	const setClause = fields.map((key) => `${key} = ?`).join(', ');

	await run(
		`UPDATE user_preferences SET ${setClause} WHERE userID = ?`,
		[...values, userID]
	)
}

export const setBackDefPref = async (userID: number) => {
	await run(`DELETE FROM user_preferences WHERE userID = ?`, [userID]);
	await run(`INSERT INTO user_preferences (userID) VALUES (?)`, [userID]);
};

export const getStatsForUser = async (userID: number) => {
  const results = await getAll<{
	matchID: number;
	tourID: number | null;
	rulesPaddleSpeed: number;
	rulesBallSpeed: number;
	rulesLimit: number;
	rulesCondition: number;
	started_at: string;
	duration: number;
	score: number;
	result: number;
  }>(
	`SELECT
	  mh.matchID, mh.tourID, mh.rulesPaddleSpeed, mh.rulesBallSpeed, mh.rulesLimit, mh.rulesCondition, mh.started_at, mh.duration,
	  st.score, st.result
	FROM scoreTable st
	JOIN matchHistory mh ON st.matchID = mh.matchID
	WHERE st.userID = ?`,
	[userID]
  );
  if (!results || results.length === 0) {
	  return { winPercentage: { win: 0, lose: 0, tie: 0 }, matchHistory: []};
  }
  const winPercentage = Stats.getWinPercentage(results);
  // console.log(`[getStatsForUser] goals: ${goals.length}, goals: ${JSON.stringify(goals)}`);
  return { winPercentage: winPercentage, matchHistory: results};
};

async function ensureSeedUsersForFuzzer() {
  const seeds = [
    { id: 1, uname: 'bot1' },
    { id: 2, uname: 'bot2' },
    { id: 3, uname: 'bot3' },
    { id: 4, uname: 'bot4' },
  ];

  for (const s of seeds) {
    await run(
      // English: INTEGER PRIMARY KEY can be assigned explicitly in SQLite
      `INSERT OR IGNORE INTO users (our_index, rand_id, username, password_hashed)
       VALUES (?, ?, ?, ?)`,
      [s.id, `seed-${s.id}`, s.uname, 'x']
    );
  }
}

// English: pick a starting id > current MAX(matchID) and far from real games
async function getNextFuzzMatchId(minStart = 1_000_000): Promise<number> {
  const row = await get<{ max: number }>(`SELECT COALESCE(MAX(matchID), 0) AS max FROM matchHistory`, []);
  const next = (row?.max ?? 0) + 1;
  return Math.max(next, minStart);
}

export async function startScoreTableFuzzer() {
  // English: disable by default; enable only when needed
  if (process.env.ENABLE_FUZZER !== '1') {
    console.log('[Fuzzer] disabled (set ENABLE_FUZZER=1 to enable)');
    return;
  }

  await new Promise(resolve => setTimeout(resolve, 1500));

  let matchID = await getNextFuzzMatchId(); // e.g. start at >= 1_000_000
  const TOTAL_MATCHES = Number(process.env.FUZZER_MATCHES ?? 500); // lower default to avoid spamming

  for (let i = 0; i < TOTAL_MATCHES; i++, matchID++) {
    const duration    = randomInt(5, 1000);
    const paddleSpeed = randomInt(1, 100);
    const ballSpeed   = randomInt(1, 100);
    const gameMode    = randomInt(0, 2); // 0=1v1, 1=2v2
    let players: Array<{ userID: number; score: number; result: number }>;

    if (gameMode === 0) {
      const result = randomInt(0, 3); // 0=lose,1=win,2=tie
      if (result === 2) {
        const s = randomInt(5, 100);
        players = [
          { userID: 1, score: s, result: 2 },
          { userID: 2, score: s, result: 2 }
        ];
      } else if (result === 1) {
        const a = randomInt(5, 100), b = randomInt(0, a);
        players = [
          { userID: 1, score: a, result: 1 },
          { userID: 2, score: b, result: 0 }
        ];
      } else {
        const b = randomInt(5, 100), a = randomInt(0, b);
        players = [
          { userID: 1, score: a, result: 0 },
          { userID: 2, score: b, result: 1 }
        ];
      }
    } else {
      const result = randomInt(0, 3); // 0=team2 wins,1=team1 wins,2=tie
      if (result === 2) {
        const s = randomInt(5, 100);
        players = [
          { userID: 1, score: s, result: 2 },
          { userID: 3, score: s, result: 2 },
          { userID: 2, score: s, result: 2 },
          { userID: 4, score: s, result: 2 }
        ];
      } else if (result === 1) {
        const t1 = randomInt(5, 100), t2 = randomInt(0, t1);
        players = [
          { userID: 1, score: t1, result: 1 },
          { userID: 3, score: t1, result: 1 },
          { userID: 2, score: t2, result: 0 },
          { userID: 4, score: t2, result: 0 }
        ];
      } else {
        const t2 = randomInt(5, 100), t1 = randomInt(0, t2);
        players = [
          { userID: 1, score: t1, result: 0 },
          { userID: 3, score: t1, result: 0 },
          { userID: 2, score: t2, result: 1 },
          { userID: 4, score: t2, result: 1 }
        ];
      }
    }

    try {
      await saveMatchStats(matchID, null, paddleSpeed, ballSpeed, 15, 'score', players, duration, true);
    } catch (err) {
      console.error('[Fuzzer] saveMatchStats failed for matchID=', matchID, err);
      // English: continue; do not crash the process
    }
  }
  console.log(`[Fuzzer] done`);
}

if (process.env.ENABLE_FUZZER === '1') {
  startScoreTableFuzzer().catch(err => console.error('[Fuzzer] fatal', err));
}
