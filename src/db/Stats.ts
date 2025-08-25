import { run, get, getAll } from './userManagement';

export async function insertBallBounceHistory(
    matchID: number,
    last_userID_touch: number | null,
    typeof_bounce: 0 | 1 | 2,
    ball_speed: number,
    position_x: number,
    position_y: number,
    angle: number,
    bounce_at_ms: number
) {
    await run(
        `INSERT INTO ball_bounce_history (matchID, last_userID_touch, typeof_bounce, ball_speed, position_x, position_y, angle, bounce_at_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            matchID,
            last_userID_touch,
            typeof_bounce,
            ball_speed,
            position_x,
            position_y,
            angle,
            bounce_at_ms,
        ]
    );
}

export const getBallBounceHistoryWithMatchID = async (userID: number) => {
  const result = await getAll<{
    x: number;
    y: number;
    matchID: number;
    typeof_bounce: number; // 0 = wall, 1 = paddle, 2 = goal
  }>(
    `SELECT
       CAST(ROUND(b.position_x) AS INTEGER) AS x,
       CAST(ROUND(b.position_y) AS INTEGER) AS y,
       b.matchID,
       b.typeof_bounce
     FROM ball_bounce_history b
     WHERE b.last_userID_touch = ?`,
    [userID]
  );
  return result || [];
};

export const getBallBounceHistory = async (userID: number, heatmap_type: number) => {
  const results = await getAll<{
    x: number;
    y: number;
    value: number;
  }>(
    `SELECT
       CAST(ROUND(b.position_x) AS INTEGER) AS x,
       CAST(ROUND(b.position_y) AS INTEGER) AS y,
       COUNT(*) AS value
     FROM ball_bounce_history b
     WHERE b.typeof_bounce = ?
       AND b.last_userID_touch = ?
       AND b.matchID IN (
         SELECT st.matchID
         FROM scoreTable st
         GROUP BY st.matchID
         HAVING COUNT(st.userID) = 2
       )
     GROUP BY x, y`,
    [heatmap_type, userID]
  );

  //  AND b.matchID IN (
  //    SELECT DISTINCT st.matchID FROM scoreTable st WHERE st.userID = ?
  //  )

  // console.log(`[getBallBounceHistory] Found ${results.length}, ${JSON.stringify(results, null, 1)}`);
  return results || [];
};

export const getWinPercentage = async (results: Array<{ result: number }>) => {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  for (const match of results) {
    if (match.result === 1) wins++;
    else if (match.result === 0) losses++;
    else if (match.result === 2) ties++;
    // console.log(`[getWinPercentage] wins: ${wins}, losses: ${losses}, ties: ${ties}`);
  }
  if (results.length === 0) {
    return { win: 0, lose: 0, tie: 0 };
  } else {
    return {
      win: Number(((wins / results.length) * 100).toFixed(1)),
      lose: Number(((losses / results.length) * 100).toFixed(1)),
      tie: Number(((ties / results.length) * 100).toFixed(1))
    };
  }
};

export const getMatchHistoryForUser = async (userID: number) => {
  return getAll<{
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
};