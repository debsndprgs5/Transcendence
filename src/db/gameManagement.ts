import { randomInt } from 'crypto';
import sqlite3 from 'sqlite3';
import { user } from '../types/user';
import * as chatType from '../types/chat';
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
		`SELECT u.username, gm.userID
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
  await run('BEGIN TRANSACTION');
  try {
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
	// une seule requête sql
	const placeholders = players.map(() => '(?, ?, ?, ?)').join(',');
	const values = players.flatMap(p => [matchID, p.userID, p.score, p.result]);
	await run(
	  `INSERT INTO scoreTable (matchID, userID, score, result) VALUES ${placeholders};`,
	  values
	);
	await run('COMMIT');
  } catch (err) {
	await run('ROLLBACK');
	console.error('[saveMatchStats] Transaction failed, rolled back.', err);
	throw err;
  }
  if (fromFuzzer) return;
  for (const p of players) {
	// console.log(`[saveMatchStats]1 Pushing stats to user ${p.userID}`);
	try {
	  const playerSocket = getPlayerByUserID(p.userID);
	  if (playerSocket && playerSocket.typedSocket) {
		// console.log(`[saveMatchStats]2 Pushing stats to user ${p.userID}`);
		playerSocket.typedSocket.send('statsResult', await getStatsForUser(p.userID));
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


export const getStatsForUser = async (userID: number) => {
	const results = await Stats.getMatchHistoryForUser(userID);
	const winPercentage = await Stats.getWinPercentage(results);
	const ball_wall = await Stats.getBallBounceHistory(userID, 0);
	const ball_paddle = await Stats.getBallBounceHistory(userID, 1);
	const ball_goal = await Stats.getBallBounceHistory(userID, 2);
	const ball_withMatchID = await Stats.getBallBounceHistoryWithMatchID(userID);

	// console.log(`[getStatsForUser] winPercentage: ${JSON.stringify(winPercentage)}`);
	// console.log(`[getStatsForUser] matchHistory: ${results.length} matches`);
	// console.log(`[getStatsForUser] ballBounceHistory: ${ball.length} bounces`);
	// console.log(`[getStatsForUser] ball_withMatchID: ${ball_withMatchID.length} bounces with matchID`);
  return { winPercentage: winPercentage, matchHistory: results, ballWallHistory: ball_wall, ballPaddleHistory: ball_paddle, ballGoalHistory: ball_goal, allBounces: ball_withMatchID };
};

export async function startScoreTableFuzzer() {
  await new Promise(resolve => setTimeout(resolve, 1500));
  const TOTAL_MATCHES = 5;
  const BATCH_SIZE = 1;
  console.log(`Début du fuzzing pour ${TOTAL_MATCHES} matchs...`);

  try {
    for (let i = 0; i < TOTAL_MATCHES; i += BATCH_SIZE) {
      const batchLimit = Math.min(i + BATCH_SIZE, TOTAL_MATCHES);
      const currentBatchSize = batchLimit - i;
      const matchHistoryValues: any[] = [];
      const scoreTableValues: any[] = [];
      for (let matchID = i + 1; matchID <= batchLimit; matchID++) {
        const duration = randomInt(5, 1000);
        const paddleSpeed = randomInt(1, 100);
        const ballSpeed = randomInt(1, 100);
        const gameMode = randomInt(0, 2); // 0=1v1, 1=2v2
        let players;

        if (gameMode === 0) {
          const result = randomInt(0, 3); // 0=lose, 1=win, 2=tie
          let scoreA, scoreB;
          if (result === 2) {
            scoreA = scoreB = randomInt(5, 100);
            players = [
              { userID: 1, score: scoreA, result: 2 },
              { userID: 2, score: scoreB, result: 2 }
            ];
          } else if (result === 1) {
            scoreA = randomInt(5, 100);
            scoreB = randomInt(0, scoreA);
            players = [
              { userID: 1, score: scoreA, result: 1 },
              { userID: 2, score: scoreB, result: 0 }
            ];
          } else {
            scoreB = randomInt(5, 100);
            scoreA = randomInt(0, scoreB);
            players = [
              { userID: 1, score: scoreA, result: 0 },
              { userID: 2, score: scoreB, result: 1 }
            ];
          }
        } else {
          const result = randomInt(0, 3); // 0=team2 wins, 1=team1 wins, 2=tie
          let scoreTeam1, scoreTeam2;
          if (result === 2) {
            scoreTeam1 = scoreTeam2 = randomInt(5, 100);
            players = [
              { userID: 1, score: scoreTeam1, result: 2 }, { userID: 3, score: scoreTeam1, result: 2 },
              { userID: 2, score: scoreTeam2, result: 2 }, { userID: 4, score: scoreTeam2, result: 2 }
            ];
          } else if (result === 1) {
            scoreTeam1 = randomInt(5, 100);
            scoreTeam2 = randomInt(0, scoreTeam1);
            players = [
              { userID: 1, score: scoreTeam1, result: 1 }, { userID: 3, score: scoreTeam1, result: 1 },
              { userID: 2, score: scoreTeam2, result: 0 }, { userID: 4, score: scoreTeam2, result: 0 }
            ];
          } else {
            scoreTeam2 = randomInt(5, 100);
            scoreTeam1 = randomInt(0, scoreTeam2);
            players = [
              { userID: 1, score: scoreTeam1, result: 0 }, { userID: 3, score: scoreTeam1, result: 0 },
              { userID: 2, score: scoreTeam2, result: 1 }, { userID: 4, score: scoreTeam2, result: 1 }
            ];
          }
        }
        matchHistoryValues.push(matchID, null, paddleSpeed, ballSpeed, 15, 1, duration);
        players.forEach(p => {
          scoreTableValues.push(matchID, p.userID, p.score, p.result);
        });
      }
      await run('BEGIN TRANSACTION');
      try {
        const matchHistoryPlaceholders = Array(currentBatchSize).fill('(?, ?, ?, ?, ?, ?, ?)').join(',');
        await run(
          `INSERT INTO matchHistory (matchID, tourID, rulesPaddleSpeed, rulesBallSpeed, rulesLimit, rulesCondition, duration) VALUES ${matchHistoryPlaceholders};`,
          matchHistoryValues
        );
        const scoreTablePlaceholders = Array(scoreTableValues.length / 4).fill('(?, ?, ?, ?)').join(',');
        await run(
          `INSERT INTO scoreTable (matchID, userID, score, result) VALUES ${scoreTablePlaceholders};`,
          scoreTableValues
        );
        await run('COMMIT');
        // console.log(`[Fuzzer] Lot de ${currentBatchSize} matchs inséré. (${batchLimit}/${TOTAL_MATCHES})`);
		} catch (err) {
			await run('ROLLBACK');
			console.error('[Fuzzer] La transaction du lot a échoué, annulation.', err);
			throw err;
		}
	}
	console.log(`Fuzzing terminé : ${TOTAL_MATCHES} matchs générés.`);
  } catch (err) {
	console.error('[Fuzzer] Une erreur a arrêté le processus de fuzzing.', err);
  }
  startBallBounceHistoryFuzzer();
}

export async function startBallBounceHistoryFuzzer() {
	await new Promise(resolve => setTimeout(resolve, 1500));
	const TOTAL_BOUNCES = 200000000; // 2000 rebonds
	const TOTAL_MATCHES = 5; // Doit correspondre au fuzzer de scoreTable
	const BATCH_SIZE = 1; // 500 rebonds à la fois
	console.log(`Début du fuzzing pour ${TOTAL_BOUNCES} rebonds de balle...`);

	try {
		for (let i = 0; i < TOTAL_BOUNCES; i += BATCH_SIZE) {
			const batchLimit = Math.min(i + BATCH_SIZE, TOTAL_BOUNCES);
			const currentBatchSize = batchLimit - i;
			const values: any[] = [];
			for (let j = 0; j < currentBatchSize; j++) {
				const matchID = randomInt(1, TOTAL_MATCHES + 1);
				const last_userID_touch = randomInt(1, 3); // 1 or 2
				const typeof_bounce = randomInt(0, 3); // 0=wall, 1=paddle, 2=goal
				const ball_speed = Math.random() * 99 + 1; // Vitesse entre 1 et 100
				const position_x = Math.random() * 60 - 30; // -30 à 30
				const position_y = Math.random() * 34 - 17;  // -17 à 17
				const angle = Math.random() * 2 * Math.PI;
				const bounce_at_ms = randomInt(1000, 600000); // Entre 1s et 10min
				values.push(
					matchID,
					last_userID_touch,
					typeof_bounce,
					ball_speed,
					position_x,
					position_y,
					angle,
					bounce_at_ms
				);
			}
			await run('BEGIN TRANSACTION');
			try {
				const placeholders = Array(currentBatchSize).fill('(?, ?, ?, ?, ?, ?, ?, ?)').join(',');
				await run(
					`INSERT INTO ball_bounce_history (matchID, last_userID_touch, typeof_bounce, ball_speed, position_x, position_y, angle, bounce_at_ms) VALUES ${placeholders};`,
					values
				);
				await run('COMMIT');
				// console.log(`[Fuzzer] Lot de ${currentBatchSize} rebonds inséré. (${batchLimit}/${TOTAL_BOUNCES})`);
			} catch (err) {
				await run('ROLLBACK');
				console.error('[Fuzzer] La transaction du lot a échoué, annulation.', err);
				throw err;
			}
		}
		console.log(`Fuzzing de ball_bounce_history terminé : ${TOTAL_BOUNCES} rebonds générés.`);
	} catch (err) {
		console.error('[Fuzzer] Une erreur a arrêté le processus de fuzzing de ball_bounce_history.', err);
	}
}
// startScoreTableFuzzer();