import { isAuthenticated } from './api';

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
	const username = user.username || '';
	const style = /^\d+$/.test(username)
    ? 'bottts'
    : 'initials';
	const avatar = user.avatarUrl || `https://api.dicebear.com/9.x/${style}/svg`
								    + `?seed=${encodeURIComponent(username)}`
									+ `&backgroundType=gradientLinear`
  									+ `&backgroundColor=919bff,133a94`  
  								    + `&size=64`
								    + `&radius=50`

	return `
		<div class="min-h-screen flex items-center justify-center py-10">
			<div class="bg-white rounded-xl shadow-xl max-w-lg w-full">
				<div class="px-8 py-8 flex flex-col items-center bg-indigo-50 rounded-t-xl">
					<img src="${avatar}" id="account-avatar" alt="Avatar" class="w-24 h-24 rounded-full shadow-lg border-4 border-indigo-200 mb-4 cursor-pointer">
					<input type="file" id="avatarInput" class="hidden" accept="image/*">
					<h2 class="text-2xl font-bold text-indigo-700 mb-1">${username}</h2>
				</div>
				<div class="px-8 py-6">
					<form id="profileForm" class="space-y-3">
						<div>
							<label for="newPassword" class="block text-sm font-medium">New password</label>
							<input type="password" id="newPassword" name="newPassword" class="mt-1 block w-full rounded p-2 border border-gray-300">
						</div>
						<button type="submit" class="w-full bg-indigo-600 text-white py-2 rounded">Change password</button>
					</form>
					<button id="setup2faBtn" class="mt-3 w-full bg-yellow-500 text-black py-2 rounded">Re-config 2FA</button>
				</div>
				<div class="px-8 py-4 border-t border-gray-200">
					<h3 class="text-lg font-semibold text-indigo-700 mb-2">My good ol' friends</h3>
					<ul id="friendsList" class="space-y-2">
						${friends.map(friend => `
							<li class="py-1 border-b flex justify-between items-center">
								<span class="flex-1 truncate">
									${friend.username}
									<span class="friend-status ml-2 text-xs align-middle" data-userid="${friend.our_index}"></span>
								</span>
								<span class="flex gap-2">
									<button class="chat-friend-btn text-xl" data-username="${friend.username}" data-userid="${friend.our_index}" title="Chat">💬</button>
									<button class="profile-friend-btn text-xl" data-username="${friend.username}" title="Profile">👤</button>
									<button class="remove-friend-btn text-xl text-red-500" data-username="${friend.username}" title="Remove">❌</button>
								</span>
							</li>
						`).join('')}
					</ul>
				</div>
				<div class="px-8 pb-8">
					<button id="backHomeBtn" class="mt-6 w-full py-2 px-4 bg-gray-200 text-indigo-700 rounded hover:bg-gray-300 transition">← Go back</button>
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
