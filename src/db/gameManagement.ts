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
	maxPlayers: number,
	status: string
) => {
	return run(
		`INSERT INTO tournaments (name, createdBy, maxPlayers, status)
		 VALUES (?, ?, ?, ?)`,
		[name, createdBy, maxPlayers, status]
	);
};

export const delTournament = (tournamentID: number) =>
	run(`DELETE FROM tournaments WHERE tournamentID = ?`, [tournamentID]);

export const getTournamentById = (tournamentID: number) =>
	get<{ tournamentID: number; name: string; createdBy: number; maxPlayers: number; status: string; created_at: string }>(
		`SELECT * FROM tournaments WHERE tournamentID = ?`,
		[tournamentID]
	);

export const getAllTournaments = () =>
	getAll<{ tournamentID: number; name: string; createdBy: number; maxPlayers: number; status: string }>(
		`SELECT tournamentID, name, createdBy, maxPlayers, status FROM tournaments`
	);

// Add a member to a tournament
export const addMemberToTournament = (tournamentID: number, userID: number) =>
	run(
		`INSERT INTO tournamentMembers (tournamentID, userID, points, matchesPlayed)
		 VALUES (?, ?, 0, 0)`,
		[tournamentID, userID]
	);

// Eventually remove a member from a tournament
export const delMemberFromTournament = (tournamentID: number, userID: number) =>
	run(`DELETE FROM tournamentMembers WHERE tournamentID = ? AND userID = ?`, [tournamentID, userID]);

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

// ########################
// #      USERSTAT        #
// ########################

export const createData = (gameID: number, userID: number, mode: string, result: string, score: string, duration: number, datas: string) =>
	run(
		`INSERT INTO userStat (gameID, userID, mode, result, score, gameDuration, datas) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[gameID, userID, mode, result, score, duration, datas]
	);

export const addData = createData; // Alias

export const getAllDataFromId = (userID: number) =>
	getAll<{ gameID: number; mode: string; result: string; score: string; gameDuration: number; datas: string }>(
		`SELECT * FROM userStat WHERE userID = ?`,
		[userID]
	);

export const getAllDataFromGameId = (gameID: number) =>
	getAll<{ userID: number; result: string; score: string }>(
		`SELECT * FROM userStat WHERE gameID = ?`,
		[gameID]
	);
