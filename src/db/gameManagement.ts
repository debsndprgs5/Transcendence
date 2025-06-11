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
    `SELECT u.username, u.our_index AS userID
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

export const createTournament = (round: number, playersData: string) =>
  run(`INSERT INTO tournaments (round, players_data) VALUES (?, ?)`, [round, playersData]);

export const delTournament = (tournamentID: number) =>
  run(`DELETE FROM tournaments WHERE tournamentID = ?`, [tournamentID]);

export const updateTournamentData = (tournamentID: number, playersData: string) =>
  run(`UPDATE tournaments SET players_data = ? WHERE tournamentID = ?`, [playersData, tournamentID]);

export const getTournamentData = (tournamentID: number) =>
  get<{ tournamentID: number; round: number; players_data: string }>(
    `SELECT * FROM tournaments WHERE tournamentID = ?`,
    [tournamentID]
  );

export const getAllTournamentMembers = (tournamentID: number) =>
  getAll<{ userID: number; alias: string }>(
    `SELECT userID, alias FROM gameMembers WHERE tournamentID = ?`,
    [tournamentID]
  );

export const updateTournamentRound = (tournamentID: number, round: number) =>
  run(
    `UPDATE tournaments SET round = ? WHERE tournamentID = ?`,
    [round, tournamentID]
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
