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

//Needs to retrun gameID created 
export const createGameRoom = (type: string, state: string, mode:string, rules:string ,tournamentID: number | null = null) =>
  run(
    `INSERT INTO gameRooms (type, state, mode, rules, tournamentID) VALUES (?, ?, ?, ?, ?)`,
    [type, state, mode, rules, tournamentID]
  );

export const deleteGameRoom = (gameID: number) =>
  run(`DELETE FROM gameRooms WHERE gameID = ?`, [gameID]);

export const getGameRoom = (gameID: number) =>
  get<{ gameID: number; mode: string; rules: string; tournamentID: number | null }>(
    `SELECT * FROM gameRooms WHERE gameID = ?`,
    [gameID]
  );

export const getAllPublicGames = () =>
	getAll<{gameID:number; mode:string; name:string}>(
		`SELECT * FROM gameRooms WHERE type=public & state=waiting`
	);

// ########################
// #    GAME MEMBERS      #
// ########################

export const addMemberToGameRoom = (gameID: number, userID: number, alias: string, tournamentID: number | null = null) =>
  run(
    `INSERT INTO gameMembers (gameID, userID, alias, tournamentID) VALUES (?, ?, ?, ?)`,
    [gameID, userID, alias, tournamentID]
  );

export const delMemberFromGameRoom = (gameID: number, userID: number) =>
  run(`DELETE FROM gameMembers WHERE gameID = ? AND userID = ?`, [gameID, userID]);

export const getAllMembersFromGameRoom = (gameID: number) =>
  getAll<{ userID: number; alias: string }>(
    `SELECT userID, alias FROM gameMembers WHERE gameID = ?`,
    [gameID]
  );

export const getLastAddedToRoom = (gameID:number) =>
	get<{userID:number, alias:string}>(
		`SELECT userID, alias
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
