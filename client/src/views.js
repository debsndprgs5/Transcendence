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
		<div class="flex justify-between items-center mb-6">
			<h1 class="text-2xl font-semibold text-indigo-600">
				Welcome, <span class="font-bold">${userName}</span> !
			</h1>
		</div>

		<div class="grid gap-6 md:grid-cols-3">
			<!-- Game section 2/3 of screen -->
			<div class="md:col-span-2 flex justify-center items-center bg-transparent p-0 m-0">
			  <div class="relative w-full max-w-5xl">
			    <img src="../screen.png" alt="CRT frame" class="w-full h-auto">
			    <div class="absolute top-[15%] left-[14.5%] w-[70%] h-[56%]">
			      <canvas id="pong-canvas" class="w-full h-full rounded-[4px] shadow-inner bg-black"></canvas>
			    </div>
			  </div>
			</div>
			<!-- Chat section -->
			<div class="bg-white p-6 rounded-lg shadow-lg flex flex-col h-full min-h-0">
				<h2 class="text-2xl font-semibold text-indigo-600 mb-4 flex justify-between items-center gap-2">
					<button id="generalChatBtn" 
						class="text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer">
					Chat
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
					<!-- Room list -->
				  <ul id="room-list" class="w-1/3 border-r border-gray-200 pr-4 space-y-2 overflow-auto min-h-0">
						<!-- populated dynamically -->
					</ul>
					<!-- Messages -->
					<div class="w-2/3 pl-4 flex flex-col">
						<div id="chat" class="flex-1 overflow-auto space-y-2 mb-4 break-words"></div>
						<form id="chatForm" class="flex space-x-2">
							<input name="message" placeholder="Write a message…"
								class="flex-1 border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-300" />
							<button type="submit"
								class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
								Send
							</button>
						</form>
					</div>
				</div>
			</div>
		</div>
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