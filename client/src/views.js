import { isAuthenticated } from './api.js';

// ─── RENDER ──────────────────────────────────────────────────────────────────
export function render(html) {
	const app = document.getElementById('app');
	if (app) app.innerHTML = html;
}


// ─── VIEWS ────────────────────────────────────────────────────────────────────

export function HomeView() {
	if (!isAuthenticated()) {
		// user not connected
		return `
			<section class="bg-white rounded-lg shadow-lg overflow-hidden md:flex">
				<div class="p-8 md:w-1/2">
					<h1 class="text-4xl font-bold text-indigo-600 mb-4">
						Welcome in Transcendence
					</h1>
					<p class="text-gray-700 mb-6">
						Play pong with your friends, chat with them and have fun !
					</p>
					<div class="space-x-4">
						<a href="/register" data-link
							 class="inline-block px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition">
							Register now
						</a>
						<a href="/login" data-link
							 class="inline-block px-6 py-3 border border-indigo-600 text-indigo-600 font-medium rounded-lg hover:bg-indigo-50 transition">
							Login
						</a>
					</div>
				</div>
				<div class="md:w-1/2 bg-indigo-50 flex items-center justify-center">
					<img src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExMGxybmhtZmdwNTU0YjVqOThnMXdmaGlic3QxdXFod2N0aDZnNTRpNCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o72FkiKGMGauydfyg/giphy.gif"
							 alt="not implemented yet"
							 class="w-3/4 h-auto">
				</div>
			</section>
		`;
	}

	// user connected
	const userName = localStorage.getItem('username') || '';
	return `
		<main class="flex-grow w-full" style="
			 background: linear-gradient(
				 90deg,
				 rgba(164,116,81,1)   0%,
				 rgba(156,152,129,1) 16.667%,
				 rgba(115,160,157,1) 33.333%,
				 rgba(59,137,154,1)  50.000%,
				 rgba(9,91,121,1)    66.667%,
				 rgba(0,40,71,1)     83.333%,
				 rgba(0,1,22,1)     100.000%
			 );">
			<div class="
				pt-6
				px-[4px] sm:px-[8px] lg:px-[12px]
				mx-auto
				w-[95vw] max-w-[1600px]
			">
				<h1 class="text-2xl font-semibold text-indigo-100 mb-4">
					Welcome, <strong>${userName}</strong>!
				</h1>

				<div class="grid gap-6 grid-cols-1 md:grid-cols-[57%_43%]">
					<!-- Game @ 57% -->
					<div class="flex justify-center items-center p-4 sm:p-6 rounded-lg shadow-lg"
							 style="
								 background: conic-gradient(
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
								 );
							 ">
						<div class="relative w-full max-w-5xl">
							<img src="../screen.png" alt="CRT frame" class="w-full h-auto">
							<div class="absolute top-[14%] left-[14%] w-[71.2%] h-[55%]">
								<canvas id="pong-canvas"
												class="w-full h-full rounded-[4px] shadow-inner bg-black">
								</canvas>
							</div>
						</div>
					</div>

					<!-- Chat @ 43% -->
					<div class="p-4 sm:p-6 rounded-lg shadow-lg flex flex-col"
							 style="
								 background: conic-gradient(
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
								 );
							 ">
						<h2 class="text-2xl font-semibold text-gray-900 mb-4 flex justify-between items-center">
							<button id="generalChatBtn"
											class="text-gray-900 hover:text-gray-700 transition-colors">
								Chat
							</button>
							<div class="flex items-center gap-2">
							</button>
							<div class="flex items-center gap-2">
								<input id="userActionInput" type="text" placeholder="Username or ID"
									class="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-200 text-sm" style="width: 140px;" />
								<button id="addFriendBtn" 
									class="px-2 py-1 bg-green-400 text-black rounded hover:bg-green-500 transition text-xs">Add Friend</button>
								<button id="blockUserBtn" 
									class="px-2 py-1 bg-yellow-400 text-black rounded hover:bg-yellow-500 transition text-xs">Block</button>
								<button id="unblockUserBtn" 
									class="px-2 py-1 bg-gray-300 text-black rounded hover:bg-gray-400 transition text-xs">Unblock</button>
								<button id="newChatRoomBtn" 
									class="px-3 py-1 bg-indigo-100 text-indigo-600 rounded hover:bg-indigo-200 transition text-sm">New Room</button>
							</div>
						</h2>
						<div class="flex-1 overflow-auto mb-4 flex">
							<ul id="room-list"
									class="w-1/3 border-r border-gray-300 pr-4 space-y-2 overflow-auto min-h-0 text-gray-900">
							</ul>
							<div class="w-2/3 pl-4 flex flex-col">
								<div id="chat"
										 class="flex-1 overflow-auto space-y-2 mb-4 break-words text-gray-900">
								</div>
								<form id="chatForm" class="flex space-x-2">
									<input name="message" placeholder="Write a message…"
												 class="flex-1 border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-[#6DD5FA]">
									<button type="submit"
													class="px-4 py-2 bg-[#2980B9] text-white rounded-lg hover:bg-[#2278A1] transition">
										Send
									</button>
								</form>
							</div>
						</div>
					</div>
				</div>
			</div>
		</main>
	`;
}


export function LoginView() {
	return `
		<div class="min-h-screen flex items-start justify-center pt-10 bg-gradient-to-r from-indigo-500 to-blue-500 p-4">
			<div class="bg-white rounded-xl shadow-xl overflow-hidden w-full max-w-md transform -translate-y-4">
				<!------ Colored header ------>
				<div class="px-8 py-6 bg-indigo-600 text-white text-center">
					<h2 class="text-3xl font-bold">Log in</h2>
					<p class="mt-2">Log in to your account</p>
				</div>
				<!------ Form ------>
				<form id="loginForm" class="px-8 py-6 space-y-6 bg-white">
					<div>
						<label for="username" class="block text-sm font-medium text-gray-700">Username</label>
						<input id="username" name="username" type="text" required
									 class="mt-1 block w-full px-4 py-2 border-2 border-indigo-300 rounded-lg
													focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"/>
					</div>
					<div>
						<label for="password" class="block text-sm font-medium text-gray-700">Password</label>
						<input id="password" name="password" type="password" required
									 class="mt-1 block w-full px-4 py-2 border-2 border-indigo-300 rounded-lg
													focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"/>
					</div>
					<button type="submit"
									class="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold 
												 hover:bg-indigo-700 transition">
						Login
					</button>
					<p id="login-error" class="text-red-500 text-sm text-center hidden"></p>
				</form>
				<!------ Transit to register ------>
				<div class="px-8 py-4 bg-gray-100 text-center">
					<p class="text-sm text-gray-600">
						You don't have an account ?
						<a href="/register" data-link class="text-indigo-600 font-medium hover:underline">
							Register now
						</a>
					</p>
				</div>
			</div>
		</div>
	`;
}

export function RegisterView() {
	return `
		<div class="min-h-screen flex items-start justify-center pt-10 bg-gradient-to-r from-purple-500 to-purple-700 p-4">
			<div class="bg-white rounded-xl shadow-xl overflow-hidden w-full max-w-md transform -translate-y-4">
				<!------ Colored header ------>
				<div class="px-8 py-6 bg-indigo-600 text-white text-center">
					<h2 class="text-3xl font-bold">Register</h2>
					<p class="mt-2">Create your account</p>
				</div>
				<!------ Form ------>
				<form id="registerForm" class="px-8 py-6 space-y-6 bg-white">
					<div>
						<label for="username" class="block text-sm font-medium text-gray-700">Username</label>
						<input id="username" name="username" type="text" required
									 class="mt-1 block w-full px-4 py-2 border-2 border-purple-300 rounded-lg
													focus:outline-none focus:ring-2 focus:ring-purple-400 transition"/>
					</div>
					<div>
						<label for="password" class="block text-sm font-medium text-gray-700">Password</label>
						<input id="password" name="password" type="password" required
									 class="mt-1 block w-full px-4 py-2 border-2 border-purple-300 rounded-lg
													focus:outline-none focus:ring-2 focus:ring-purple-400 transition"/>
					</div>
					<button type="submit"
									class="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold 
												 hover:bg-indigo-700 transition">
						Create my account
					</button>
					<p id="register-error" class="text-red-500 text-sm text-center hidden"></p>
				</form>
				<!------ Transit to login ------>
				<div class="px-8 py-4 bg-gray-100 text-center">
					<p class="text-sm text-gray-600">
						Already have an account ?
						<a href="/login" data-link class="text-indigo-600 font-medium hover:underline">
							Log in
						</a>
					</p>
				</div>
			</div>
		</div>
	`;
}



export function Setup2FAView(otpauth_url, base32) {
	// using quickchart api to generate qr code
	const chartUrl = `https://quickchart.io/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(otpauth_url)}`;
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
				<input id="2fa-setup-code" placeholder="Enter 2FA code"
							 class="w-full border-gray-300 rounded-md shadow-sm p-2 
											focus:ring-yellow-500 focus:border-yellow-500" />
				<button id="verify-setup-2fa-btn"
								class="w-full py-2 px-4 bg-yellow-600 text-black font-semibold 
											 rounded-md hover:bg-yellow-700 transition">
					Verify authenticator code
				</button>
				<p id="setup2fa-error" class="text-red-500 text-sm mt-2 hidden"></p>
			</div>
		</div>
	`;
}

export function Verify2FAView() {
	return `
		<div class="max-w-md mx-auto mt-12 bg-white shadow-lg rounded-lg overflow-hidden">
			<div class="px-6 py-4 bg-yellow-50">
				<h2 class="text-2xl font-bold text-yellow-700">Verify 2FA</h2>
			</div>
			<form id="verifyForm" class="px-6 py-4 space-y-4">
				<div>
					<label class="block text-sm font-medium text-gray-700">Code 2FA</label>
					<input id="2fa-code" name="code" required
								 class="mt-1 block w-full border-gray-300 rounded-md shadow-sm 
												focus:ring-yellow-500 focus:border-yellow-500" />
				</div>
				<button type="submit"
								class="w-full py-2 px-4 bg-yellow-600 text-black font-semibold 
											 rounded-md hover:bg-yellow-700 transition">
					Verify
				</button>
				<p id="verify-error" class="text-red-500 text-sm mt-2 hidden"></p>
			</form>
		</div>
	`;
}

export function AccountView(user, friends = []) {
	const username = user.username || '';
	const avatar = user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=6d28d9&color=fff&rounded=true`;

	return `
	<div class="min-h-screen flex items-center justify-center bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 py-10">
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


export function ProfileView(profileUser) {
	const username = profileUser.username || '';
	const avatar =
	profileUser.avatarUrl ||
	`https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=6d28d9&color=fff&rounded=true`;

	return `
	<div class="min-h-screen flex items-center justify-center bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 py-10">
		<div class="bg-white rounded-xl shadow-xl max-w-lg w-full">
		<div class="px-8 py-8 flex flex-col items-center bg-indigo-50 rounded-t-xl">
			<img
			src="${avatar}"
			alt="${username}"
			class="w-24 h-24 rounded-full shadow-lg border-4 border-indigo-200 mb-4"
			/>
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
			<button
			id="backBtnProfile"
			class="mt-6 w-full py-2 px-4 bg-gray-200 text-indigo-700 rounded hover:bg-gray-300 transition"
			>
			← Back
			</button>
		</div>
		</div>
	</div>
	`;
}