import { isAuthenticated } from './api';
import { fetchAccountStats, state } from './pong_socket';
import { showWallBouncesHeatmap, showPaddleBouncesHeatmap, showGoalsHeatmap, convertBouncesToHeatmap2p, gameToHeatmap2p } from './heatmaps';

// Store all three heatmap datasets returned by the server
let goalsHeatmapData: {
  wall: Array<{ x: number; y: number; value: number }>;
  paddle: Array<{ x: number; y: number; value: number }>;
  goal: Array<{ x: number; y: number; value: number }>;
} = { wall: [], paddle: [], goal: [] };

function updateStatsChart(stats: { win: number, lose: number, tie: number }) {
  const canvas = document.getElementById('stats-chart');
  const legendEl = document.getElementById('stats-legend');
  if (!canvas || !(canvas instanceof HTMLCanvasElement) || !stats) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const data = [
    { label: 'Win', value: stats.win, color: '#10B981' },
    { label: 'Lose', value: stats.lose, color: '#EF4444' },
    { label: 'Tie', value: stats.tie, color: '#F59E0B' }
  ];
  const filteredData = data.filter(item => item.value > 0);
  if (filteredData.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#6B7280';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No games played', canvas.width / 2, canvas.height / 2);
    if (legendEl) legendEl.innerHTML = '<span class="text-gray-500">No data available</span>';
    return;
  }
  const total = filteredData.reduce((sum, item) => sum + item.value, 0);
  let currentAngle = -Math.PI / 2; // commencer en haut
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) - 10;
  filteredData.forEach(item => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    currentAngle += sliceAngle;
  });
  if (legendEl) {
    legendEl.innerHTML = filteredData.map(item => 
      `<span class="inline-block mr-4">
        <span class="inline-block w-3 h-3 rounded-full mr-1" style="background-color: ${item.color}"></span>
        ${item.label}: ${item.value}%
      </span>`
    ).join('');
  }
}

(window as any).updateStatsDisplay = updateStatsDisplay;

function updateStatsDisplay(data: any) {
  console.log('[updateStatsDisplay] Received data:', data);
  if (data.winPercentage) {
    updateStatsChart(data.winPercentage);
    const totalWins = Math.round((data.winPercentage.win / 100) * getTotalGames(data));
    const totalLosses = Math.round((data.winPercentage.lose / 100) * getTotalGames(data));
    const totalTies = Math.round((data.winPercentage.tie / 100) * getTotalGames(data));
    updateElementText('wins-count', totalWins.toString());
    updateElementText('losses-count', totalLosses.toString());
    updateElementText('ties-count', totalTies.toString());
    updateElementText('total-games', getTotalGames(data).toString());
    updateElementText('win-rate', `${data.winPercentage.win}%`);
  }
  if (data.matchHistory) {
    updateMatchHistory(data.matchHistory);
    calculateAdvancedStats(data.matchHistory);
  }
    // store heatmap
    const ConvertBounceHistory = (raw: any): Array<{ x: number; y: number; value: number }> => {
      if (!Array.isArray(raw) || raw.length === 0) return [];
      if ('position_x' in raw[0] || 'positionX' in raw[0]) return convertBouncesToHeatmap2p(raw as any);
      if (!('x' in raw[0] && 'y' in raw[0])) return [];

      const counts = (raw as any[]).reduce((m: Map<string, number>, r) => {
        const { x, y, value } = r;
        const mapped = gameToHeatmap2p(x, y);
        const key = `${Math.round(mapped.x)},${Math.round(mapped.y)}`;
        // const key = `${mapped.x.toFixed(1)},${mapped.y.toFixed(1)}`;
        m.set(key, (m.get(key) ?? 0) + (value ?? 1));
        return m;
      }, new Map<string, number>());

      return Array.from(counts.entries()).map(([k, v]) => {
        const [sx, sy] = k.split(',').map(Number);
        // const [sx, sy] = k.split(',').map(s => parseFloat(s));
        return { x: sx, y: sy, value: v };
      });
    };

    goalsHeatmapData.wall = ConvertBounceHistory(data.ballWallHistory);
    goalsHeatmapData.paddle = ConvertBounceHistory(data.ballPaddleHistory);
    goalsHeatmapData.goal = ConvertBounceHistory(data.ballGoalHistory);
}

function updateElementText(id: string, text: string) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
  }
}

function getTotalGames(data: any): number {
  if (data.matchHistory && Array.isArray(data.matchHistory)) {
    return data.matchHistory.length;
  }
  return 0;
}

let matchHistoryDisplayCount = 30;
let matchHistoryCache: any[] = [];

function updateMatchHistory(matchHistory: any[]) {
  const tableBody = document.getElementById('match-history-table');
  const showMoreBtnId = 'show-more-matches-btn';
  if (!tableBody || !Array.isArray(matchHistory)) return;
  matchHistoryCache = matchHistory;
  // affiche que les x premiers matchs
  const toDisplay = matchHistory.slice(0, matchHistoryDisplayCount);
  tableBody.innerHTML = toDisplay.map(match => {
    const resultClass = match.result === 1 ? 'text-green-600 font-semibold' : match.result === 0 ? 'text-red-600 font-semibold' : 'text-yellow-600 font-semibold';
    const resultText = match.result === 1 ? 'Win' : match.result === 0 ? 'Loss' : 'Tie';
    const date = match.started_at ? new Date(match.started_at).toLocaleDateString() : 'N/A';
    const duration = match.duration ? formatDuration(match.duration) : 'N/A';
    const mode = match.rulesCondition === 1 ? 'Score' : 'Time';
    return `
      <tr class="hover:bg-gray-50">
        <td class="px-4 py-3 text-sm text-gray-700">${date}</td>
        <td class="px-4 py-3 text-sm text-gray-700">${match.score || 0}</td>
        <td class="px-4 py-3 text-sm ${resultClass}">${resultText}</td>
        <td class="px-4 py-3 text-sm text-gray-700">${duration}</td>
        <td class="px-4 py-3 text-sm text-gray-700">${mode}</td>
      </tr>
    `;
  }).join('');

  // show more bouton
  const holder = tableBody.closest('.overflow-x-auto');
  let showMoreBtn = document.getElementById(showMoreBtnId);
  if (matchHistory.length > matchHistoryDisplayCount) {
    if (!showMoreBtn) {
      showMoreBtn = document.createElement('button');
      showMoreBtn.id = showMoreBtnId;
      showMoreBtn.textContent = 'Show more';
      showMoreBtn.className = 'mt-4 mb-2 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition';
      showMoreBtn.style.display = 'block';
      showMoreBtn.onclick = () => {
        matchHistoryDisplayCount += 30;
        updateMatchHistory(matchHistoryCache);
      };
      const flexDiv = document.createElement('div');
      flexDiv.className = 'flex justify-center';
      flexDiv.appendChild(showMoreBtn);
      holder?.appendChild(flexDiv);
    } else {
      showMoreBtn.style.display = 'block';
    }
  } else if (showMoreBtn) {
    showMoreBtn.style.display = 'none';
  }
}

function calculateAdvancedStats(matchHistory: any[]) {
  if (!Array.isArray(matchHistory) || matchHistory.length === 0) return;
  //score moyen
  const totalScore = matchHistory.reduce((sum, match) => sum + (match.score || 0), 0);
  const avgScore = (totalScore / matchHistory.length).toFixed(1);
  updateElementText('avg-score', avgScore);
  //meilleur score
  const bestScore = Math.max(...matchHistory.map(match => match.score || 0));
  updateElementText('best-score', bestScore.toString());
  //duree moyenne
  const durations = matchHistory.filter(match => match.duration).map(match => match.duration);
  if (durations.length > 0) {
    const avgDuration = durations.reduce((sum, dur) => sum + dur, 0) / durations.length;
    updateElementText('avg-duration', formatDuration(Math.round(avgDuration)));
  }
  // streak la plus longue
  let currentStreak = 0;
  let maxStreak = 0;
  matchHistory.forEach(match => {
    if (match.result === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  });
  updateElementText('win-streak', maxStreak.toString());
  // victoires en tournoi
  const tournamentWins = matchHistory.filter(match => match.tourID && match.result === 1).length;
  updateElementText('tournament-wins', tournamentWins.toString());
  // dernier match
  if (matchHistory.length > 0) {
    const lastMatch = matchHistory[0];
    const lastGameDate = lastMatch.started_at ? new Date(lastMatch.started_at).toLocaleDateString() : 'N/A';
    updateElementText('last-game', lastGameDate);
  }
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Renders the given HTML string into the #app element.
 */
export function render(html: string): void {
	const app = document.getElementById('app');
	if (app) {
		app.innerHTML = html;
	}
}

// ─── VIEWS ────────────────────────────────────────────────────────────────────

/**
 * Returns the HTML for the home view, depending on authentication.
 */
export function HomeView(): string {
    if (!isAuthenticated()) {
      return `
        <main class="min-h-screen flex items-center justify-center px-4 py-8">
          <section class="w-full max-w-6xl h-[80vh] mt-[-5vh] bg-white/5 rounded-2xl shadow-xl overflow-hidden md:flex backdrop-blur-md border border-white/10">
            <div class="p-10 md:w-1/2 text-white flex flex-col justify-center">
              <h1 class="text-4xl font-bold mb-4 text-indigo-100">Welcome to nothing</h1>
              <p class="text-lg text-indigo-200 mb-8 leading-relaxed">
                Play Pong with your friends, chat live, climb the leaderboard, and become a legend.
              </p>
              <div class="flex gap-4">
                <a href="/register" data-link
                  class="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition shadow">
                  Register now
                </a>
                <a href="/login" data-link
                  class="px-6 py-3 border border-indigo-400 text-indigo-200 font-semibold rounded-lg hover:bg-indigo-100 hover:text-indigo-900 transition shadow">
                  Login
                </a>
              </div>
            </div>
            <div class="md:w-1/2 flex items-center justify-center bg-white/10">
              <img src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExMGxybmhtZmdwNTU0YjVqOThnMXdmaGlic3QxdXFod2N0aDZnNTRpNCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o72FkiKGMGauydfyg/giphy.gif"
                   alt="pong animation"
                   class="w-4/5 h-auto rounded-lg shadow-xl max-h-[65vh] object-contain">
           </div>
          </section>
        </main>
      `;
    }


  const userName = localStorage.getItem('username') || '';
  return `
	<main class="flex-grow w-full">
  <div class="pt-6 px-[4px] sm:px-[8px] lg:px-[12px] mx-auto w-[95vw] max-w-[1600px]">
    <h1 class="text-2xl font-semibold text-indigo-100 mb-4">
      Welcome, <strong>${userName}</strong>!
    </h1>
    <div class="grid gap-6 grid-cols-1 md:grid-cols-[57%_43%]">

      <!-- Colonne Pong/Menu -->
      <div class="flex justify-center items-center p-4 sm:p-6 rounded-lg shadow-lg"
           style="background: conic-gradient(
             from 90deg,
             rgba(187,119,2,1)    0deg,
             rgba(187,119,2,1)   27.692deg,
             rgba(202,134,27,1)  27.692deg,
             rgba(202,134,27,1)  55.385deg,
             rgba(210,147,54,1)  55.385deg,
             rgba(210,147,54,1)  83.077deg,
             rgba(210,158,79,1)  83.077deg,
             rgba(210,158,79,1) 110.769deg,
             rgba(203,165,102,1)110.769deg,
             rgba(188,169,121,1)138.462deg,
             rgba(188,169,121,1)166.154deg,
             rgba(168,170,136,1)166.154deg,
             rgba(168,170,136,1)193.846deg,
             rgba(146,166,144,1)193.846deg,
             rgba(146,166,144,1)221.538deg,
             rgba(123,159,146,1)221.538deg,
             rgba(123,159,146,1)249.231deg,
             rgba(103,148,141,1)249.231deg,
             rgba(103,148,141,1)276.923deg,
             rgba( 88,135,130,1)276.923deg,
             rgba( 88,135,130,1)304.615deg,
             rgba( 79,120,113,1)304.615deg,
             rgba( 79,120,113,1)332.308deg,
             rgba( 79,105, 92,1)332.308deg 360deg
           );">
        <div class="relative w-full max-w-5xl aspect-video">
          <img src="/screen.png" alt="CRT frame" class="w-full h-auto">
          <div class="absolute top-[14%] left-[14%] w-[71.2%] h-[55%]">
            <canvas
              id="pong-canvas"
              class="w-full h-full rounded-[4px] shadow-inner bg-black"
            ></canvas>
            <canvas
              id="babylon-canvas"
              class="w-full h-full rounded-[4px] shadow-inner bg-black hidden"
            ></canvas>
            <!-- Notre conteneur pour les menus en HTML, caché par défaut -->
            <div id="ui-overlay" class="absolute inset-0 hidden"></div>
          </div>
        </div>
      </div>

      <!-- Colonne Chat -->
      <div class="p-4 sm:p-6 rounded-lg shadow-lg flex flex-col"
           style="background: conic-gradient(
             from 90deg,
             rgba(187,119,2,1)    0deg,
             rgba(187,119,2,1)   27.692deg,
             rgba(202,134,27,1)  27.692deg,
             rgba(202,134,27,1)  55.385deg,
             rgba(210,147,54,1)  55.385deg,
             rgba(210,147,54,1)  83.077deg,
             rgba(210,158,79,1)  83.077deg,
             rgba(210,158,79,1) 110.769deg,
             rgba(203,165,102,1)110.769deg,
             rgba(188,169,121,1)138.462deg,
             rgba(188,169,121,1)166.154deg,
             rgba(168,170,136,1)166.154deg,
             rgba(168,170,136,1)193.846deg,
             rgba(146,166,144,1)193.846deg,
             rgba(146,166,144,1)221.538deg,
             rgba(123,159,146,1)221.538deg,
             rgba(123,159,146,1)249.231deg,
             rgba(103,148,141,1)249.231deg,
             rgba(103,148,141,1)276.923deg,
             rgba( 88,135,130,1)276.923deg,
             rgba( 88,135,130,1)304.615deg,
             rgba( 79,120,113,1)304.615deg,
             rgba( 79,120,113,1)332.308deg,
             rgba( 79,105, 92,1)332.308deg 360deg
           );">
        <h2 class="text-2xl font-semibold text-gray-900 mb-4 flex justify-between items-center">
          <button id="generalChatBtn" class="text-gray-900 hover:text-gray-700 transition-colors">
            Chat
          </button>
          <div class="flex items-center gap-2">
            <input id="userActionInput" type="text" placeholder="Username or ID"
                   class="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-200 text-sm" style="width:140px;" />
            <button id="addFriendBtn" class="px-2 py-1 bg-green-400 text-black rounded hover:bg-green-500 transition text-xs">Add Friend</button>
            <button id="blockUserBtn" class="px-2 py-1 bg-yellow-400 text-black rounded hover:bg-yellow-500 transition text-xs">Block</button>
            <button id="unblockUserBtn" class="px-2 py-1 bg-gray-300 text-black rounded hover:bg-gray-400 transition text-xs">Unblock</button>
            <button id="newChatRoomBtn" class="px-3 py-1 bg-indigo-100 text-indigo-600 rounded hover:bg-indigo-200 transition text-sm">New Room</button>
          </div>
        </h2>
        <div class="flex-1 overflow-auto mb-4 flex">
          <ul id="room-list" class="w-1/3 border-r border-gray-300 pr-4 space-y-2 overflow-auto min-h-0 text-gray-900"></ul>
          <div class="w-2/3 pl-4 flex flex-col">
            <div id="chat" class="flex-1 overflow-auto space-y-2 mb-4 break-words text-gray-900"></div>
            <form id="chatForm" class="flex space-x-2">
              <input name="message" placeholder="Write a message…"
                     class="flex-1 border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-[#6DD5FA]" />
              <button type="submit" class="px-4 py-2 bg-[#2980B9] text-white rounded-lg hover:bg-[#2278A1] transition">Send</button>
            </form>
          </div>
        </div>
      </div>

    </div>
  </main>
  `;
}

/**
 * Returns the HTML for the login view.
 */
export function LoginView(): string {
  return `
    <div id="Container" class="w-full h-full flex items-center justify-center">
      <!-- this wrapper holds the form + rays + base -->
      <div id="loginWrapper" class="relative inline-block">
        
        <!-- light rays cone -->
        <div id="rays"></div>

        <!-- glassy login form -->
        <form id="loginForm" class="form">
          <h2 id="login-lable">LOGIN</h2>
          <input id="username" name="username" type="text" placeholder="Username" required class="form-content" />
          <input id="password" name="password" type="password" placeholder="Password" required class="form-content" />
          <button type="submit">LOGIN</button>
          <p id="login-error" class="text-red-500 text-sm text-center hidden"></p>
          <p class="text-white text-sm">
            You don't have an account ?
            <a href="/register" data-link class="underline font-medium">Register now</a>
          </p>
        </form>

        <!-- the black base under the light -->
        <div id="base"></div>

      </div>
    </div>
  `;
}


/**
 * Returns the HTML for the register view.
 */
export function RegisterView(): string {
  return `
    <div id="Container" class="w-full h-full flex items-center justify-center">
      <!-- wrapper identical to login -->
      <div id="loginWrapper" class="relative inline-block">
        
        <!-- light rays cone -->
        <div id="rays"></div>

        <!-- glassy register form -->
        <form id="registerForm" class="form">
          <h2 id="login-lable">REGISTER</h2>

          <!-- Username field -->
          <input
            id="username"
            name="username"
            type="text"
            placeholder="Username"
            required
            class="form-content"
          />

          <!-- Password field -->
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Password"
            required
            class="form-content"
          />

          <!-- Submit button -->
          <button type="submit">REGISTER</button>

          <!-- Error message placeholder -->
          <p id="register-error" class="text-red-500 text-sm text-center hidden"></p>

          <!-- Link to login -->
          <p class="text-white text-sm">
            You already have an account ?
            <a href="/login" data-link class="underline font-medium">Login here</a>
          </p>
        </form>

        <!-- the black base under the light -->
        <div id="base"></div>

      </div>
    </div>
  `;
}

/**
 * Returns the HTML for the 2FA setup view.
 * @param otpauthUrl The otpauth URL for the QR code.
 * @param base32 The manual entry code.
 */
export function Setup2FAView(otpauthUrl: string, base32: string): string {
	const chartUrl = `https://quickchart.io/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(otpauthUrl)}`;
	return `
		<div class="max-w-md mx-auto mt-12 bg-white shadow-lg rounded-lg overflow-hidden">
			<div class="px-6 py-4 bg-yellow-50">
				<h2 class="text-2xl font-bold text-yellow-700">Configurer la 2FA</h2>
			</div>
			<div class="px-6 py-4 space-y-4 text-center">
				<p class="text-gray-700">Scan this QR code with your authenticator app :</p>
				<img src="${chartUrl}" alt="QR Code 2FA" class="mx-auto w-48 h-48" />
				<p class="text-gray-700">Or manually enter this code :</p>
				<code class="block bg-gray-100 p-2 rounded font-mono text-sm">${base32}</code>
			</div>
			<div class="px-6 pb-6 space-y-2">
				<input id="2fa-setup-code" placeholder="Enter 2FA code" class="w-full border-gray-300 rounded-md shadow-sm p-2 focus:ring-yellow-500 focus:border-yellow-500" />
				<button id="verify-setup-2fa-btn" class="w-full py-2 px-4 bg-yellow-600 text-black font-semibold rounded-md hover:bg-yellow-700 transition">Verify authenticator code</button>
				<p id="setup2fa-error" class="text-red-500 text-sm mt-2 hidden"></p>
			</div>
		</div>
	`;
}

/**
 * Returns the HTML for the 2FA verification view.
 */
export function Verify2FAView(): string {
  return `
    <div id="Container" class="w-full h-full flex items-center justify-center">
      <form id="verifyForm" class="v2fa-form">
        <div class="v2fa-content">
          <p align="center">OTP Verification</p>
          <div class="v2fa-inp">
            <input type="text" maxlength="1" required class="v2fa-input" />
            <input type="text" maxlength="1" required class="v2fa-input" />
            <input type="text" maxlength="1" required class="v2fa-input" />
            <input type="text" maxlength="1" required class="v2fa-input" />
            <input type="text" maxlength="1" required class="v2fa-input" />
            <input type="text" maxlength="1" required class="v2fa-input" />
          </div>
          <button type="submit">Verify</button>
          <svg class="v2fa-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <path
              class="v2fa-path"
              fill="#4073ff"
              d="M56.8,-23.9C61.7,-3.2,45.7,18.8,26.5,31.7C7.2,44.6,-15.2,48.2,-35.5,36.5C-55.8,24.7,-73.9,-2.6,-67.6,-25.2C-61.3,-47.7,-30.6,-65.6,-2.4,-64.8C25.9,-64.1,51.8,-44.7,56.8,-23.9Z"
              transform="translate(100 100)"
            />
          </svg>
        </div>
      </form>
    </div>
  `;
}

/**
 * Returns the HTML for the account view.
 */

export function AccountView(user: any, friends: any[] = []): string {
  // console.log('stats for user:', user);
  // console.log('user_id:', user.userId);
  if (user && user.userId) {
    // if (window.location.hash === '#account' || document.body.getAttribute('data-current-view') === 'account') {
    //   return '';
    // }
    fetchAccountStats(user.userId);
    document.body.setAttribute('data-current-view', 'account');
  }

  const username = user.username || '';
  const style = /^\d+$/.test(username)
    ? 'bottts'
    : 'initials';
	const avatar = user.avatarUrl || `https://api.dicebear.com/9.x/${style}/svg`
                + `?seed=${encodeURIComponent(username)}`
                + `&backgroundType=gradientLinear`
                + `&backgroundColor=919bff,133a94`  
                + `&size=64`
                + `&radius=50`;

  const heatmaps = [
    { id: 'heatmap-wall', label: 'Wall Bounces', onClick: () => showWallBouncesHeatmap(goalsHeatmapData.wall) },
    { id: 'heatmap-paddle', label: 'Paddle Bounces', onClick: () => showPaddleBouncesHeatmap(goalsHeatmapData.paddle) },
    { id: 'heatmap-goal', label: 'Goals', onClick: () => showGoalsHeatmap(goalsHeatmapData.goal) },
    // #moooooore heatmaps
  ];

  setTimeout(() => {
    heatmaps.forEach(hm => {
      const btn = document.querySelector(`button[data-heatmap="${hm.id}"]`);
      if (!btn) return;
      btn.addEventListener('click', () => {
        // deactivate all heatmap buttons
        const all = document.querySelectorAll('.heatmap-btn');
        all.forEach(el => {
          el.classList.remove('bg-indigo-700', 'text-white', 'shadow');
          el.classList.add('bg-indigo-100', 'text-indigo-700');
        });
        // activate clicked button
        btn.classList.remove('bg-indigo-100', 'text-indigo-700');
        btn.classList.add('bg-indigo-700', 'text-white', 'shadow');
        // call the original handler
        try {
          hm.onClick();
        } catch (e) {
          // swallow errors from handlers to avoid breaking UI
          console.error('heatmap handler error', e);
        }
      });
    });
  }, 0);

	return `
		<div class="min-h-screen bg-gray-100 py-8">
			<div class="max-w-6xl mx-auto px-4">
				<!-- Header avec avatar et nom -->
				<div class="bg-white rounded-xl shadow-lg mb-8">
					<div class="px-8 py-8 flex items-center bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-t-xl">
						<img src="${avatar}" id="account-avatar" alt="Avatar" class="w-24 h-24 rounded-full shadow-lg border-4 border-white mr-6 cursor-pointer">
						<input type="file" id="avatarInput" class="hidden" accept="image/*">
						<div>
							<h1 class="text-3xl font-bold">${username}</h1>
							<p class="text-lg opacity-90">Player Dashboard</p>
						</div>
					</div>
				</div>

				<!-- Grille de statistiques -->
				<div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
					
					<!-- Statistiques globales -->
					<div class="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
						<h2 class="text-2xl font-bold text-gray-800 mb-6">Game Statistics</h2>
						
						<!-- Graphique circulaire -->
						<div class="flex flex-col lg:flex-row items-center mb-8">
							<div class="lg:w-1/2 mb-4 lg:mb-0">
								<canvas id="stats-chart" width="250" height="250" class="mx-auto"></canvas>
								<div id="stats-legend" class="mt-4 text-center text-sm"></div>
							</div>
							<div class="lg:w-1/2 lg:pl-8">
								<div class="grid grid-cols-2 gap-4">
									<div class="bg-green-50 p-4 rounded-lg text-center">
										<div class="text-2xl font-bold text-green-600" id="wins-count">-</div>
										<div class="text-sm text-gray-600">Wins</div>
									</div>
									<div class="bg-red-50 p-4 rounded-lg text-center">
										<div class="text-2xl font-bold text-red-600" id="losses-count">-</div>
										<div class="text-sm text-gray-600">Losses</div>
									</div>
									<div class="bg-yellow-50 p-4 rounded-lg text-center">
										<div class="text-2xl font-bold text-yellow-600" id="ties-count">-</div>
										<div class="text-sm text-gray-600">Ties</div>
									</div>
									<div class="bg-blue-50 p-4 rounded-lg text-center">
										<div class="text-2xl font-bold text-blue-600" id="total-games">-</div>
										<div class="text-sm text-gray-600">Total Games</div>
									</div>
								</div>
							</div>
						</div>

						<!-- Statistiques avancées -->
						<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
							<div class="bg-gray-50 p-4 rounded-lg">
								<h3 class="text-lg font-semibold text-gray-700 mb-2">Average Score</h3>
								<div class="text-2xl font-bold text-indigo-600" id="avg-score">-</div>
							</div>
							<div class="bg-gray-50 p-4 rounded-lg">
								<h3 class="text-lg font-semibold text-gray-700 mb-2">Best Score</h3>
								<div class="text-2xl font-bold text-green-600" id="best-score">-</div>
							</div>
							<div class="bg-gray-50 p-4 rounded-lg">
								<h3 class="text-lg font-semibold text-gray-700 mb-2">Avg Game Duration</h3>
								<div class="text-2xl font-bold text-purple-600" id="avg-duration">-</div>
							</div>
						</div>
					</div>

					<!-- Section profil et préférences -->
					<div class="space-y-6">
						<!-- Paramètres du compte -->
						<div class="bg-white rounded-xl shadow-lg p-6">
							<h2 class="text-xl font-bold text-gray-800 mb-4">Account Settings</h2>
							<form id="profileForm" class="space-y-4">
								<div>
									<label for="newPassword" class="block text-sm font-medium text-gray-700">New Password</label>
									<input type="password" id="newPassword" name="newPassword" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2">
								</div>
								<button type="submit" class="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition">Update Password</button>
							</form>
							<button id="setup2faBtn" class="mt-4 w-full bg-yellow-500 text-black py-2 px-4 rounded-md hover:bg-yellow-600 transition">Re-config 2FA</button>
						</div>

						<!-- Statistiques rapides -->
						<div class="bg-white rounded-xl shadow-lg p-6">
							<h2 class="text-xl font-bold text-gray-800 mb-4">Quick Stats</h2>
							<div class="space-y-3">
								<div class="flex justify-between">
									<span class="text-gray-600">Win Rate</span>
									<span class="font-semibold" id="win-rate">-%</span>
								</div>
								<div class="flex justify-between">
									<span class="text-gray-600">Longest Win Streak</span>
									<span class="font-semibold" id="win-streak">-</span>
								</div>
								<div class="flex justify-between">
									<span class="text-gray-600">Tournament Wins</span>
									<span class="font-semibold" id="tournament-wins">-</span>
								</div>
								<div class="flex justify-between">
									<span class="text-gray-600">Last Game</span>
									<span class="font-semibold" id="last-game">-</span>
								</div>
							</div>
						</div>
					</div>
				</div>

        <!-- Panel Heatmaps -->
        <div class="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 class="text-2xl font-bold text-gray-800 mb-6">Ball Heatmaps</h2>
          <div class="flex flex-wrap gap-4 mb-6" id="heatmap-btn-panel">
            ${heatmaps.map(hm => `
              <button class="heatmap-btn px-4 py-2 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition font-semibold" data-heatmap="${hm.id}">${hm.label}</button>
            `).join('')}
          </div>
          <div id="heatmap-holder" class="w-full min-h-[320px] flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200">
            <!-- Heatmap canvas or SVG will be injected here -->
            <span class="text-gray-400">Select a heatmap to display ball stats.</span>
          </div>
        </div>

				<!-- Historique des matchs -->
				<div class="bg-white rounded-xl shadow-lg p-6 mb-8">
					<h2 class="text-2xl font-bold text-gray-800 mb-6">Match History</h2>
					<div class="overflow-x-auto max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
						<table class="w-full">
							<thead class="sticky top-0 bg-gray-50 z-10">
								<tr>
									<th class="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
									<th class="px-4 py-3 text-left text-sm font-medium text-gray-700">Score</th>
									<th class="px-4 py-3 text-left text-sm font-medium text-gray-700">Result</th>
									<th class="px-4 py-3 text-left text-sm font-medium text-gray-700">Duration</th>
									<th class="px-4 py-3 text-left text-sm font-medium text-gray-700">Mode</th>
								</tr>
							</thead>
							<tbody id="match-history-table" class="divide-y divide-gray-200">
								<!-- Les matchs seront ajoutés ici dynamiquement -->
							</tbody>
						</table>
					</div>
				</div>

				<!-- Liste des amis -->
				<div class="bg-white rounded-xl shadow-lg p-6 mb-8">
					<h2 class="text-2xl font-bold text-gray-800 mb-6">Friends</h2>
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						${friends.map(friend => `
							<div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
								<div class="flex items-center justify-between">
									<div class="flex items-center">
										<div class="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
											<span class="text-indigo-600 font-semibold">${friend.username.charAt(0).toUpperCase()}</span>
										</div>
										<div>
											<div class="font-medium text-gray-900">${friend.username}</div>
											<span class="friend-status text-xs text-gray-500" data-userid="${friend.our_index}">Offline</span>
										</div>
									</div>
									<div class="flex gap-2">
										<button class="chat-friend-btn text-blue-600 hover:text-blue-800" data-username="${friend.username}" data-userid="${friend.our_index}" title="Chat">💬</button>
										<button class="profile-friend-btn text-gray-600 hover:text-gray-800" data-username="${friend.username}" title="Profile">👤</button>
										<button class="remove-friend-btn text-red-600 hover:text-red-800" data-username="${friend.username}" title="Remove">❌</button>
									</div>
								</div>
							</div>
						`).join('')}
					</div>
				</div>

				<!-- Bouton retour -->
				<div class="text-center">
					<button id="backHomeBtn" class="px-8 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition shadow-md">← Back to Home</button>
				</div>
			</div>
		</div>
	`;
}

/**
 * Returns the HTML for the profile view.
 */
export function ProfileView(profileUser: any): string {
	const username = profileUser.username || '';
	const style = /^\d+$/.test(username)
    ? 'bottts'
    : 'initials';
	const avatar = profileUser.avatarUrl || `https://api.dicebear.com/9.x/${style}/svg`
                + `?seed=${encodeURIComponent(username)}`
                + `&backgroundType=gradientLinear`
                + `&backgroundColor=919bff,133a94`  
                + `&size=64`
                + `&radius=50`

	return `
		<div class="min-h-screen flex items-center justify-center py-10">
			<div class="bg-white rounded-xl shadow-xl max-w-lg w-full">
				<div class="px-8 py-8 flex flex-col items-center bg-indigo-50 rounded-t-xl">
					<img src="${avatar}" alt="${username}" class="w-24 h-24 rounded-full shadow-lg border-4 border-indigo-200 mb-4">
					<h2 class="text-2xl font-bold text-indigo-700 mb-1">${username}</h2>
				</div>
				<div class="px-8 py-6">
					<div id="profile-stats" class="space-y-2">
						<h3 class="text-lg font-semibold">Stats</h3>
						<p class="text-gray-500">(Stats placeholder)</p>
					</div>
					<div id="game-history" class="mt-6">
						  <h3 class="text-lg font-semibold">Recent Games</h3>
						<ul class="list-disc list-inside text-gray-500">
							<li>Game history placeholder</li>
            </ul>
					</div>
				</div>
				<div class="px-8 pb-8">
					<button id="backBtnProfile" class="mt-6 w-full py-2 px-4 bg-gray-200 text-indigo-700 rounded hover:bg-gray-300 transition">← Back</button>
				</div>
			</div>
		</div>
	`;
}
