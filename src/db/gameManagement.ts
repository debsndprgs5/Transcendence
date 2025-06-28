import sqlite3 from 'sqlite3';
import { user } from '../types/user';
import * as chatType from '../types/chat';

import { run, get, getAll } from './userManagement';

let db: sqlite3.Database;

export function setDb(database: sqlite3.Database) {
	db = database;
}

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
	limit:number
) => {
	return run(
		`INSERT INTO tournaments (name, createdBy, playersCount, status, paddle_speed, ball_speed, "limit")
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[name, createdBy, playersCount, status, paddle_speed, ball_speed, limit]
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



// ############################
// #       Match Result       #
// ############################

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