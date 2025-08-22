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

function preventBodyScroll(): void {
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.overflow = 'hidden';
}
/**
 * Returns the HTML for the home view, depending on authentication.
 */
export function HomeView(): string {
	//preventBodyScroll();
    if (!isAuthenticated()) {
      return `
        <main class="min-h-screen flex items-center justify-center px-4 py-8">
          <section class="w-full max-w-6xl h-[80vh] mt-[-5vh] bg-white/5 rounded-2xl shadow-xl overflow-hidden md:flex backdrop-blur-md border border-white/10">
            <div class="p-10 md:w-1/2 text-white flex flex-col justify-center">
              <h1 class="text-4xl font-bold mb-4 text-indigo-100">Welcome to Transcendence</h1>
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
              <img src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExZnhjdTU4NHdsNTVocW54bndicnN0bDZ0ZG02NzN3azJvbGg2MnFjNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/9tx0gy37p7oXu/giphy.gif"
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
      <div class="pt-6 px-[4px] sm:px-[8px] lg:px-[12px] mx-auto w-[95vw] max-w-[1800px]">
        <h1 class="text-2xl font-semibold text-indigo-100 mb-4">
          Welcome, <strong>${userName}</strong>!
        </h1> 

        <div class="grid gap-6 grid-cols-1 md:grid-cols-[57%_43%]">

        <!-- Pong / Menu column -->
        <div
          class="flex justify-center items-start
                 p-4 sm:p-6 rounded-lg shadow-lg
                 bg-pongmenu-ui bg-cover bg-center
                 min-h-[85vh] relative">

            <div id="pongWrapper"
                 class="absolute bg_gmenu-container"
                 style="top:8%; left:10%; width:80%; height:58%;">
            <canvas id="pong-canvas"
                    class="w-full h-full rounded-[4px] shadow-inner bg-transparent relative z-10">
            </canvas>
            <canvas id="babylon-canvas"
                    class="w-full h-full rounded-[4px] shadow-inner bg-black hidden relative z-10">
            </canvas>
          </div> 

        </div>
        <div id="portal_rays"  class="portal-halo pointer-events-none"></div>
        <div id="portal_base"  class="portal-base pointer-events-none"></div>
        <!-- Chat column -->
        <div
          class="relative rounded-lg shadow-lg text-white
                 bg-chat-starry bg-cover bg-contain bg-no-repea
                 min-h-[85vh]">        <!-- same floor/ceiling -->

          <!-- General Chat button -->
          <button id="generalChatBtn"
                  class="absolute left-[5%] top-[2%]
                         text-2xl font-bold
                         hover:text-indigo-300 transition">
            General Chat
          </button>

          <!-- Action bar (username input + buttons) -->
          <div class="absolute left-[32%] top-[0.5%] flex items-center gap-2">
            <div class="topchatinput-textInputWrapper">
              <input id="userActionInput" type="text" placeholder="Username or ID"
                     class="topchatinput-textInput" />
            </div>
            <button id="addFriendBtn"    class="chatactionbarbutton-button">Add Friend</button>
            <button id="blockUserBtn"    class="chatactionbarbutton-button">Block</button>
            <button id="unblockUserBtn"  class="chatactionbarbutton-button">Unblock</button>
            <button id="newChatRoomBtn"  class="chatactionbarbutton-button">New Room</button>
          </div>

          <!-- Rooms list -->
          <ul id="room-list"
              class="absolute left-[6.5%] top-[18.5%]
                     w-[20%] h-[80%]
                     space-y-[1.4rem] overflow-auto text-gray-200">
          </ul>

          <!-- Messages area -->
          <div id="chat"
               class="absolute left-[35%] top-[18%]
                      w-[62%] h-[66%]
                      overflow-y-auto space-y-2 pr-2 break-words">
          </div>

          <!-- Send-message form -->
          <form id="chatForm"
                class="absolute left-[35%] bottom-[6%] w-[62%] flex space-x-2">
            <input name="message" placeholder="Write a message…"
                   class="flex-1 border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-[#6DD5FA] text-black" />
            <button type="submit"
                    class="px-4 py-2 bg-[#2980B9] text-white rounded-lg hover:bg-[#2278A1] transition">
              Send
            </button>
          </form>
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
	//preventBodyScroll();
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
 // preventBodyScroll();
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
//	preventBodyScroll();
	const chartUrl = `https://quickchart.io/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(otpauthUrl)}`;
  return `
    <div class="max-w-md mx-auto mt-12 bg-gray-800 bg-opacity-50 backdrop-blur rounded-xl shadow-lg overflow-hidden">
      <div class="px-6 py-4 bg-gradient-to-r from-[#2C3E50] to-[#4CA1AF]">
        <h2 class="text-2xl font-bold text-gray-100">Configurer la 2FA</h2>
      </div>
      <div class="px-6 py-4 space-y-4 text-center">
        <p class="text-gray-200">Scan this QR code with your authenticator app :</p>
        <img src="${chartUrl}" alt="QR Code 2FA" class="mx-auto w-48 h-48 rounded shadow-md" />
        <p class="text-gray-200">Or manually enter this code :</p>
        <code class="block bg-gray-900 bg-opacity-30 p-2 rounded font-mono text-sm text-gray-200">${base32}</code>
      </div>
      <div class="px-6 pb-6 space-y-2">
        <input
          id="2fa-setup-code"
          placeholder="Enter 2FA code"
          class="w-full bg-gray-900 text-gray-200 border-gray-600 rounded-md shadow-sm p-2 focus:ring-[#4CA1AF] focus:border-[#4CA1AF]"
        />
        <button
          id="verify-setup-2fa-btn"
          class="w-full py-2 px-4 bg-gradient-to-r from-[#2C3E50] to-[#4CA1AF] text-gray-100 font-semibold rounded-md hover:from-[#1E2B38] hover:to-[#35707A] transition"
        >
          Verify authenticator code
        </button>
        <p id="setup2fa-error" class="text-red-500 text-sm mt-2 hidden"></p>
      </div>
    </div>
  `;
}

/**
 * Returns the HTML for the 2FA verification view.
 */
export function Verify2FAView(): string {
//	preventBodyScroll();
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
  if (user && user.userId) {
    // if (window.location.hash === '#account' || document.body.getAttribute('data-current-view') === 'account') {
    //   return '';
    // }
    fetchAccountStats(user.userId);
    document.body.setAttribute('data-current-view', 'account');
  }

  const username = user.username || '';
  const style = /^\d+$/.test(username) ? 'bottts' : 'initials';
  const avatar =
    user.avatarUrl ||
    `https://api.dicebear.com/9.x/${style}/svg` +
    `?seed=${encodeURIComponent(username)}` +
    `&backgroundType=gradientLinear` +
    `&backgroundColor=919bff,133a94` +
    `&size=64` +
    `&radius=50`;

  const heatmaps = [
    { id: 'heatmap-wall', label: 'Wall Bounces', onClick: () => showWallBouncesHeatmap(goalsHeatmapData.wall) },
    { id: 'heatmap-paddle', label: 'Paddle Bounces', onClick: () => showPaddleBouncesHeatmap(goalsHeatmapData.paddle) },
    { id: 'heatmap-goal', label: 'Goals', onClick: () => showGoalsHeatmap(goalsHeatmapData.goal) },
    // #moooooore heatmaps
  ];

  // Branche les boutons + hydrate les avatars amis APRÈS montage effectif
  setTimeout(() => {
    // 1) boutons heatmap
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

    // 2) attendre que #friends-grid existe, puis hydrater
    const waitForGrid = () => {
      const grid = document.getElementById('friends-grid');
      if (!grid) {
        requestAnimationFrame(waitForGrid);
        return;
      }

      const seen = new Set<string>();

      grid.querySelectorAll<HTMLImageElement>('img[data-username]').forEach(async (img) => {
        const u = (img.dataset.username || '').trim();
        if (!u || seen.has(u)) return;
        seen.add(u);

        // Si déjà remplacé par un custom, on ne touche pas.
        const srcNow = img.getAttribute('src') || '';
        if (srcNow && !srcNow.includes('dicebear.com')) return;

        const setCustom = (url: string) => {
          const abs = new URL(url, window.location.origin).toString();
          img.src = abs + (abs.includes('?') ? '&' : '?') + 'v=' + Date.now(); // bust cache
        };

        // 1) endpoint profil qui renvoie { avatarUrl }
        try {
          const r = await fetch(`/users/username/${encodeURIComponent(u)}`, {
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
          });
          if (r.ok) {
            const data = await r.json() as { avatarUrl?: string | null };
            if (data?.avatarUrl) { setCustom(data.avatarUrl); return; }
          }
        } catch { /* on tente l’autre */ }

        // 2) endpoint avatar direct qui renvoie { avatar_url }
        try {
          const r2 = await fetch(`/api/users/${encodeURIComponent(u)}/avatar`, {
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
          });
          if (r2.ok) {
            const data2 = await r2.json() as { avatar_url?: string | null };
            if (data2?.avatar_url) { setCustom(data2.avatar_url); return; }
          }
        } catch { /* on garde le fallback */ }
      });
    };

    waitForGrid();
  }, 0);

  return `
    <div class="min-h-screen bg-transparent text-gray-200 py-8">
      <div class="max-w-6xl mx-auto px-4">
        <!-- Header with avatar and name -->
        <div class="bg-gray-800 bg-opacity-50 backdrop-blur rounded-xl shadow-lg mb-8">
          <div class="px-8 py-8 flex items-center bg-gradient-to-r from-[#2C3E50] to-[#4CA1AF] text-white rounded-t-xl">
            <img src="${avatar}" id="account-avatar" alt="Avatar"
                 class="w-24 h-24 rounded-full shadow-xl border-2 border-indigo-700 mr-6 cursor-pointer">
            <input type="file" id="avatarInput" class="hidden" accept="image/*">
            <div>
              <h1 class="text-3xl font-bold">${username}</h1>
              <p class="text-lg opacity-80">Player Dashboard</p>
            </div>
          </div>
        </div>

        <!-- Statistics grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div class="lg:col-span-2 bg-gray-800 bg-opacity-50 backdrop-blur rounded-xl shadow-lg p-6">
            <h2 class="text-2xl font-bold text-gray-200 mb-6">Game Statistics</h2>
            <div class="flex flex-col lg:flex-row items-center mb-8">
              <div class="lg:w-1/2 mb-4 lg:mb-0">
                <canvas id="stats-chart" width="250" height="250" class="mx-auto"></canvas>
                <div id="stats-legend" class="mt-4 text-center text-sm text-gray-400"></div>
              </div>
              <div class="lg:w-1/2 lg:pl-8">
                <div class="grid grid-cols-2 gap-4">
                  <div class="bg-green-900 bg-opacity-30 p-4 rounded-lg text-center">
                    <div class="text-2xl font-bold text-green-400" id="wins-count">-</div>
                    <div class="text-sm text-gray-400">Wins</div>
                  </div>
                  <div class="bg-red-900 bg-opacity-30 p-4 rounded-lg text-center">
                    <div class="text-2xl font-bold text-red-400" id="losses-count">-</div>
                    <div class="text-sm text-gray-400">Losses</div>
                  </div>
                  <div class="bg-yellow-900 bg-opacity-30 p-4 rounded-lg text-center">
                    <div class="text-2xl font-bold text-yellow-300" id="ties-count">-</div>
                    <div class="text-sm text-gray-400">Ties</div>
                  </div>
                  <div class="bg-blue-900 bg-opacity-30 p-4 rounded-lg text-center">
                    <div class="text-2xl font-bold text-blue-300" id="total-games">-</div>
                    <div class="text-sm text-gray-400">Total Games</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div class="bg-gray-800 bg-opacity-30 p-4 rounded-lg">
                <h3 class="text-lg font-semibold text-gray-300 mb-2">Average Score</h3>
                <div class="text-2xl font-bold text-indigo-400" id="avg-score">-</div>
              </div>
              <div class="bg-gray-800 bg-opacity-30 p-4 rounded-lg">
                <h3 class="text-lg font-semibold text-gray-300 mb-2">Best Score</h3>
                <div class="text-2xl font-bold text-green-400" id="best-score">-</div>
              </div>
              <div class="bg-gray-800 bg-opacity-30 p-4 rounded-lg">
                <h3 class="text-lg font-semibold text-gray-300 mb-2">Avg Game Duration</h3>
                <div class="text-2xl font-bold text-purple-400" id="avg-duration">-</div>
              </div>
            </div>
          </div>

          <div class="space-y-6">
            <div class="bg-gray-800 bg-opacity-50 backdrop-blur rounded-xl shadow-lg p-6">
              <h2 class="text-xl font-bold text-gray-200 mb-4">Account Settings</h2>
              <form id="profileForm" class="space-y-4">
                <div>
                  <label for="newPassword" class="block text-sm font-medium text-gray-300">New Password</label>
                  <input type="password" id="newPassword" name="newPassword"
                         class="mt-1 block w-full rounded-md border-gray-600 bg-gray-900 text-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2">
                </div>
                <button type="submit"
                        class="w-full bg-gradient-to-r from-[#1E2B38] via-[#2C6B72] to-[#35707A] text-white py-2 px-4 rounded-2xl shadow-lg hover:from-[#121820] hover:via-[#1B424D] hover:to-[#1E4042] transition">
                  Update Password
                </button>
              </form>
              <button id="setup2faBtn"
                      class="mt-4 w-full bg-gradient-to-r from-[#1E2B38] via-[#2C6B72] to-[#35707A] text-white py-2 px-4 rounded-2xl shadow-lg hover:from-[#121820] hover:via-[#1B424D] hover:to-[#1E4042] transition">
                Re-config 2FA
              </button>
            </div>

            <div class="bg-gray-800 bg-opacity-50 backdrop-blur rounded-xl shadow-lg p-6">
              <h2 class="text-xl font-bold text-gray-200 mb-4">Quick Stats</h2>
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-gray-400">Win Rate</span>
                  <span class="font-semibold" id="win-rate">-%</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Longest Win Streak</span>
                  <span class="font-semibold" id="win-streak">-</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Tournament Wins</span>
                  <span class="font-semibold" id="tournament-wins">-</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Last Game</span>
                  <span class="font-semibold" id="last-game">-</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Heatmap panel -->
        <div class="bg-gray-800 bg-opacity-50 backdrop-blur rounded-xl shadow-lg p-6 mb-8">
          <h2 class="text-2xl font-bold text-gray-200 mb-6">Ball Heatmaps</h2>
          <div class="flex flex-wrap gap-4 mb-6" id="heatmap-btn-panel">
            ${heatmaps.map(hm => `
              <button class="heatmap-btn px-4 py-2 bg-gradient-to-r from-[#1E2B38] via-[#2C6B72] to-[#35707A] text-white py-2 px-4 rounded-2xl shadow-lg hover:from-[#121820] hover:via-[#1B424D] hover:to-[#1E4042] transition font-semibold"
                      data-heatmap="${hm.id}">${hm.label}</button>
            `).join('')}
          </div>
          <div id="heatmap-holder"
               class="w-full min-h-[320px] flex items-center justify-center bg-gray-900 border border-gray-700 rounded-lg">
            <span class="text-gray-500">Select a heatmap to display ball stats.</span>
          </div>
        </div>

        <!-- Match history -->
        <div class="bg-gray-800 bg-opacity-50 backdrop-blur rounded-xl shadow-lg p-6 mb-8">
          <h2 class="text-2xl font-bold text-gray-200 mb-6">Match History</h2>
          <div class="overflow-x-auto max-h-96 overflow-y-auto border border-gray-700 rounded-lg">
            <table class="w-full">
              <thead class="sticky top-0 bg-gray-700 z-10">
                <tr>
                  <th class="px-4 py-3 text-left text-sm font-medium text-gray-200">Date</th>
                  <th class="px-4 py-3 text-left text-sm font-medium text-gray-200">Score</th>
                  <th class="px-4 py-3 text-left text-sm font-medium text-gray-200">Result</th>
                  <th class="px-4 py-3 text-left text-sm font-medium text-gray-200">Duration</th>
                  <th class="px-4 py-3 text-left text-sm font-medium text-gray-200">Mode</th>
                </tr>
              </thead>
              <tbody id="match-history-table" class="divide-y divide-gray-700"></tbody>
            </table>
          </div>
        </div>

        <!-- Friends list -->
        <div class="bg-gray-800 bg-opacity-50 backdrop-blur rounded-xl shadow-lg p-6 mb-8">
          <h2 class="text-2xl font-bold text-gray-200 mb-6">Friends</h2>
          <div id="friends-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${friends.map(friend => {
              const s = /^\d+$/.test(friend.username) ? 'bottts' : 'initials';
              const fallback =
                `https://api.dicebear.com/9.x/${s}/svg` +
                `?seed=${encodeURIComponent(friend.username)}` +
                `&backgroundType=gradientLinear` +
                `&backgroundColor=919bff,133a94` +
                `&size=64` +
                `&radius=50`;
              const initial = friend.avatarUrl
                ? `${friend.avatarUrl}${friend.avatarUrl.includes('?') ? '&' : '?'}v=${Date.now()}`
                : fallback;

              return `
                <div class="border border-gray-700 rounded-lg p-4 transition bg-gray-900 hover:shadow-lg hover:shadow-purple-900">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center">
                      <img
                        src="${initial}"
                        alt="${friend.username} avatar"
                        class="w-10 h-10 rounded-full object-cover mr-3 bg-indigo-700/20"
                        width="40" height="40"
                        loading="lazy" decoding="async"
                        data-username="${friend.username}"
                        data-fallback="${fallback}"
                        onerror="this.src=this.dataset.fallback"
                      />
                      <div>
                        <div class="font-medium text-gray-200">${friend.username}</div>
                        <span class="friend-status text-xs text-gray-500" data-userid="${friend.our_index}">Offline</span>
                      </div>
                    </div>
                    <div class="flex gap-2">
                      <button class="chat-friend-btn p-2 bg-gradient-to-r from-[#1E2B38] via-[#2C6B72] to-[#35707A] text-white rounded-2xl shadow-lg hover:from-[#121820] hover:via-[#1B424D] hover:to-[#1E4042] transition"
                              data-username="${friend.username}" data-userid="${friend.our_index}" title="Chat">💬</button>
                      <button class="profile-friend-btn p-2 bg-gradient-to-r from-[#1E2B38] via-[#2C6B72] to-[#35707A] text-white rounded-2xl shadow-lg hover:from-[#121820] hover:via-[#1B424D] hover:to-[#1E4042] transition"
                              data-username="${friend.username}" title="Profile">👤</button>
                      <button class="remove-friend-btn p-2 bg-gradient-to-r from-[#1E2B38] via-[#2C6B72] to-[#35707A] text-white rounded-2xl shadow-lg hover:from-[#121820] hover:via-[#1B424D] hover:to-[#1E4042] transition"
                              data-username="${friend.username}" title="Remove">❌</button>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Back button -->
        <div class="text-center">
          <button id="backHomeBtn"
                  class="px-8 py-3 bg-gradient-to-r from-[#1E2B38] via-[#2C6B72] to-[#35707A] text-white rounded-2xl shadow-lg hover:from-[#121820] hover:via-[#1B424D] hover:to-[#1E4042] transition">
            ← Back to Home
          </button>
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
  const style = /^\d+$/.test(username) ? 'bottts' : 'initials';
  const avatar =
    profileUser.avatarUrl ||
    `https://api.dicebear.com/9.x/${style}/svg` +
      `?seed=${encodeURIComponent(username)}` +
      `&backgroundType=gradientLinear` +
      `&backgroundColor=919bff,133a94` +
      `&size=64` +
      `&radius=50`;

  /* After mount: fetch the profile's stats and paint the UI */
  setTimeout(async () => {
    try {
      // If your fetch signature differs (e.g. needs a token), adapt this call.
      const stats = await fetchAccountStats(profileUser.userId);
      updateStatsDisplay(stats);
    } catch (err) {
      console.error('[ProfileView] Failed to load stats for profile:', err);
    }

    // Optional: simple back button behavior
    const backBtn = document.getElementById('backBtnProfile');
    if (backBtn) {
      backBtn.addEventListener('click', () => history.back());
    }
  }, 0);

  return `
  <div class="min-h-screen relative text-gray-200">
    <!-- space/dark layered background -->
    <div class="absolute inset-0 opacity-30 pointer-events-none">
    </div>

    <div class="relative z-10 max-w-6xl mx-auto px-4 py-8">
      <!-- Header -->
      <div class="overflow-hidden rounded-2xl shadow-2xl border border-white/10 backdrop-blur bg-white/5">
        <div class="flex items-center gap-4 px-6 py-6 bg-gradient-to-r from-[#1f2937] via-[#0f172a] to-[#0b1021]">
          <img src="${avatar}" alt="${username}"
               class="w-20 h-20 rounded-full ring-2 ring-indigo-500/60 shadow-lg">
          <div class="flex-1">
            <h1 class="text-3xl font-bold tracking-tight">${username}</h1>
            <p class="text-indigo-300/80">Player Profile</p>
          </div>
          <button id="backBtnProfile"
                  class="px-4 py-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-500 transition shadow">
            ← Back
          </button>
        </div>
      </div>

      <!-- Stats + Quick Stats -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        <!-- Game Statistics (same structure/IDs as AccountView) -->
        <div class="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-xl">
          <h2 class="text-2xl font-semibold mb-6">Game Statistics</h2>

          <div class="flex flex-col lg:flex-row items-center mb-8">
            <div class="lg:w-1/2 mb-4 lg:mb-0">
              <canvas id="stats-chart" width="250" height="250" class="mx-auto"></canvas>
              <div id="stats-legend" class="mt-4 text-center text-sm text-gray-400"></div>
            </div>
            <div class="lg:w-1/2 lg:pl-8">
              <div class="grid grid-cols-2 gap-4">
                <div class="rounded-lg p-4 text-center bg-emerald-900/30">
                  <div id="wins-count" class="text-2xl font-bold text-emerald-400">-</div>
                  <div class="text-xs text-gray-400">Wins</div>
                </div>
                <div class="rounded-lg p-4 text-center bg-rose-900/30">
                  <div id="losses-count" class="text-2xl font-bold text-rose-400">-</div>
                  <div class="text-xs text-gray-400">Losses</div>
                </div>
                <div class="rounded-lg p-4 text-center bg-amber-900/30">
                  <div id="ties-count" class="text-2xl font-bold text-amber-300">-</div>
                  <div class="text-xs text-gray-400">Ties</div>
                </div>
                <div class="rounded-lg p-4 text-center bg-sky-900/30">
                  <div id="total-games" class="text-2xl font-bold text-sky-300">-</div>
                  <div class="text-xs text-gray-400">Total Games</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Advanced stats -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="rounded-lg p-4 bg-white/5">
              <h3 class="text-sm font-medium text-gray-300 mb-1">Average Score</h3>
              <div id="avg-score" class="text-2xl font-bold text-indigo-400">-</div>
            </div>
            <div class="rounded-lg p-4 bg-white/5">
              <h3 class="text-sm font-medium text-gray-300 mb-1">Best Score</h3>
              <div id="best-score" class="text-2xl font-bold text-emerald-400">-</div>
            </div>
            <div class="rounded-lg p-4 bg-white/5">
              <h3 class="text-sm font-medium text-gray-300 mb-1">Avg Game Duration</h3>
              <div id="avg-duration" class="text-2xl font-bold text-purple-400">-</div>
            </div>
          </div>
        </div>

        <!-- Quick Stats -->
        <div class="space-y-6">
          <div class="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-xl">
            <h2 class="text-xl font-semibold mb-4">Quick Stats</h2>
            <div class="space-y-3 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-400">Win Rate</span>
                <span id="win-rate" class="font-semibold">-%</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Longest Win Streak</span>
                <span id="win-streak" class="font-semibold">-</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Tournament Wins</span>
                <span id="tournament-wins" class="font-semibold">-</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Last Game</span>
                <span id="last-game" class="font-semibold">-</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Match History (same structure/IDs as AccountView) -->
      <div class="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-xl mt-8">
        <h2 class="text-2xl font-semibold mb-6">Match History</h2>
        <div class="overflow-x-auto max-h-96 overflow-y-auto rounded-lg border border-white/10">
          <table class="w-full">
            <thead class="sticky top-0 z-10 bg-slate-800/80 backdrop-blur">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-300">Date</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-300">Score</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-300">Result</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-300">Duration</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-300">Mode</th>
              </tr>
            </thead>
            <tbody id="match-history-table" class="divide-y divide-white/10">
              <!-- Filled by updateMatchHistory() -->
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>`;
}