import { run, get, getAll } from './userManagement';

export async function insertBallBounceHistory(
  matchID: number,
  last_userID_touch: number | null,
  typeof_bounce: number,      // 0 wall, 1 paddle, 2 goal
  ball_speed: number,
  position_x: number,
  position_y: number,
  angle: number,
  bounce_at_ms: number
) {
  // ensure parent row exists to satisfy FK (created with neutral defaults),
  // it will be updated later by saveMatchStats (UPSERT).
  try {
    await run(
      `INSERT OR IGNORE INTO matchHistory
       (matchID, tourID, rulesPaddleSpeed, rulesBallSpeed, rulesLimit, rulesCondition, duration)
       VALUES (?, NULL, 0, 0, 0, 1, NULL)`,
      [matchID]
    );

    await run(
      `INSERT INTO ball_bounce_history
       (matchID, last_userID_touch, typeof_bounce, ball_speed, position_x, position_y, angle, bounce_at_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        matchID,
        last_userID_touch,
        typeof_bounce,
        ball_speed,
        position_x,
        position_y,
        angle,
        bounce_at_ms
      ]
    );
  } catch (err) {
    // never crash the game loop because of telemetry logging
    console.warn('[Stats] insertBallBounceHistory failed:', err);
  }
}

export const getBallBounceHistory = async (heatmap_type: number) => {
	const results = await getAll<{
		id: number;
		matchID: number;
		last_userID_touch: number | null;
		typeof_bounce: number;
		ball_speed: number;
		position_x: number;
		position_y: number;
		angle: number;
		bounce_at: string;
		bounce_at_ms: number;
	  }>(
		`SELECT * FROM ball_bounce_history WHERE typeof_bounce = ?`,
	[2]
  );
  return results || [];
};

export const getWinPercentage = async (results: any) => {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  for (const match of results) {
    if (match.result === 1) wins++;
    else if (match.result === 0) losses++;
    else if (match.result === 2) ties++;
  }
  return {
    win: Number(((wins / results.length) * 100).toFixed(1)),
    lose: Number(((losses / results.length) * 100).toFixed(1)),
    tie: Number(((ties / results.length) * 100).toFixed(1)),
  };
};