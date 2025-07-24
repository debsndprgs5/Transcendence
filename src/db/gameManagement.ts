import { randomInt } from 'crypto';
import sqlite3 from 'sqlite3';
import { user } from '../types/user';
import * as chatType from '../types/chat';
import { PreferencesRow } from '../shared/gameTypes'
import { run, get, getAll } from './userManagement';
import { getPlayerByUserID } from '../websockets/game.socket';

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
) => {
  await run(
	`INSERT INTO matchHistory (matchID, tourID, rulesPaddleSpeed, rulesBallSpeed, rulesLimit, rulesCondition, duration) VALUES (?, ?, ?, ?, ?, ?, ?);`,
	[
	  matchID,
	  tourID || null,
	  paddleSpeed,
	  ballSpeed,
	  limit,
	  winCondition === 'score' ? 1 : 0,
	  typeof duration === 'number' ? duration : null
	]
  );

  for (const p of players) {
	await run(
	  `INSERT INTO scoreTable (matchID, userID, score, result) VALUES (?, ?, ?, ?);`,
	  [matchID, p.userID, p.score, p.result]
	);
	// Push stats update en temps réel au joueur
	try {
	  const playerSocket = getPlayerByUserID(p.userID);
	  if (playerSocket && playerSocket.typedSocket) {
		const winPercentage = await getWinPercentageForUser(p.userID);
		const matchHistory = await getMatchHistoryForUser(p.userID);
		playerSocket.typedSocket.send('statsResult', { winPercentage, matchHistory });
	  }
	} catch (err) {
	  console.warn('[saveMatchStats] Could not push stats to user', p.userID, err);
	}
  }
}

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

export const getWinPercentageForUser = async (userID: number): Promise<{ win: number, lose: number, tie: number }> => {
  const totalMatches = await get<{ count: number }>(
	`SELECT COUNT(*) as count FROM scoreTable WHERE userID = ?`,
	[userID]
  );
  if (!totalMatches || totalMatches.count === 0)
	return { win: 0, lose: 0, tie: 0 };
  const win = await get<{ count: number }>(
	`SELECT COUNT(*) as count FROM scoreTable WHERE userID = ? AND result = 1`,
	[userID]
  );
  const lose = await get<{ count: number }>(
	`SELECT COUNT(*) as count FROM scoreTable WHERE userID = ? AND result = 0`,
	[userID]
  );
  const tie = await get<{ count: number }>(
	`SELECT COUNT(*) as count FROM scoreTable WHERE userID = ? AND result = 2`,
	[userID]
  );
  return {
	win: Number((((win?.count || 0) / totalMatches.count) * 100).toFixed(1)),
	lose: Number((((lose?.count || 0) / totalMatches.count) * 100).toFixed(1)),
	tie: Number((((tie?.count || 0) / totalMatches.count) * 100).toFixed(1)),
  };
}

export const getMatchHistoryForUser = async (userID: number) => {
  return await getAll<{
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
	`SELECT matchHistory.*, scoreTable.score, scoreTable.result
	FROM matchHistory
	JOIN scoreTable ON matchHistory.matchID = scoreTable.matchID WHERE scoreTable.userID = ?`,
	[userID]
  );
};

export async function startScoreTableFuzzer() {
  let matchID = 1;
  await new Promise(resolve => setTimeout(resolve, 15000));
  await setInterval(async () => {
	let duration = randomInt(5, 242);
	let paddleSpeed = randomInt(1, 100);
	let ballSpeed = randomInt(1, 100);
	let gameMode = randomInt(0, 2); // 0=1v1, 1=2v2
	let players;

	if (gameMode === 0) {
	  let result = randomInt(0, 3); // 0=lose, 1=win, 2=tie
	  let scoreA, scoreB;
	  if (result === 2) {
		scoreA = scoreB = randomInt(5, 16);
		players = [
		  { userID: 1, score: scoreA, result: 2 },
		  { userID: 2, score: scoreB, result: 2 }
		];
	  } else if (result === 1) {
		scoreA = randomInt(10, 21);
		scoreB = randomInt(0, scoreA);
		players = [
		  { userID: 1, score: scoreA, result: 1 },
		  { userID: 2, score: scoreB, result: 0 }
		];
	  } else {
		scoreB = randomInt(10, 21);
		scoreA = randomInt(0, scoreB);
		players = [
		  { userID: 1, score: scoreA, result: 0 },
		  { userID: 2, score: scoreB, result: 1 }
		];
	  }
	  console.log(`[Fuzzer] 1v1 Match: matchID=${matchID}, scores: [${scoreA}, ${scoreB}], duration: ${duration}s`);
	} else {
	  let result = randomInt(0, 3); // 0=team2 wins, 1=team1 wins, 2=tie
	  let scoreTeam1, scoreTeam2;
	  if (result === 2) {
		// Égalité
		scoreTeam1 = scoreTeam2 = randomInt(5, 16);
		players = [
		  { userID: 1, score: scoreTeam1, result: 2 }, // Team 1 Player 1
		  { userID: 3, score: scoreTeam1, result: 2 }, // Team 1 Player 2
		  { userID: 2, score: scoreTeam2, result: 2 }, // Team 2 Player 1
		  { userID: 4, score: scoreTeam2, result: 2 }  // Team 2 Player 2
		];
	  } else if (result === 1) {
		// Team 1 gagne
		scoreTeam1 = randomInt(10, 21);
		scoreTeam2 = randomInt(0, scoreTeam1);
		players = [
		  { userID: 1, score: scoreTeam1, result: 1 }, // Team 1 Player 1 (win)
		  { userID: 3, score: scoreTeam1, result: 1 }, // Team 1 Player 2 (win)
		  { userID: 2, score: scoreTeam2, result: 0 }, // Team 2 Player 1 (lose)
		  { userID: 4, score: scoreTeam2, result: 0 }  // Team 2 Player 2 (lose)
		];
	  } else {
		// Team 2 gagne
		scoreTeam2 = randomInt(10, 21);
		scoreTeam1 = randomInt(0, scoreTeam2);
		players = [
		  { userID: 1, score: scoreTeam1, result: 0 }, // Team 1 Player 1 (lose)
		  { userID: 3, score: scoreTeam1, result: 0 }, // Team 1 Player 2 (lose)
		  { userID: 2, score: scoreTeam2, result: 1 }, // Team 2 Player 1 (win)
		  { userID: 4, score: scoreTeam2, result: 1 }  // Team 2 Player 2 (win)
		];
	  }
	  console.log(`[Fuzzer] 2v2 Match: matchID=${matchID}, scores: Team1=${scoreTeam1} vs Team2=${scoreTeam2}, duration: ${duration}s`);
	}

	await saveMatchStats(matchID, null, paddleSpeed, ballSpeed, 15, 'score', players, duration);
	matchID++;
  }, 1);
}
// startScoreTableFuzzer();
