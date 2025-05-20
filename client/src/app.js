// ─── AUTH STATE ──────────────────────────────────────────────────────────────
let authToken    = null;
let pendingToken = null;
let socket;           // global WebSocket
let userId;           // read from the cookie
let currentRoom = 0;  // selected room

// ─── AUTH HELPERS ──────────────────────────────────────────────────────────────
function isAuthenticated() {
	authToken = localStorage.getItem('token');
	return !!authToken;
}


// Add an event listener for localStorage changes
window.addEventListener('storage', (event) => {
	if (event.key === 'token') {
		// Token was changed in another tab
		authToken = event.newValue;
		if (!authToken) {
			// Token was removed, force logout
			handleLogout();
		}
	}
});

// Centralized logout handling
function handleLogout() {
	localStorage.removeItem('token');
	localStorage.removeItem('username');
	authToken = null;
	userId = null;
	currentRoom = 0;
	updateNav();

	// Close WebSocket if it's open
	if (socket && socket.readyState === WebSocket.OPEN) {
		socket.close();
	}
	
	render(HomeView());
}


// Check token validity every minute
function startTokenValidation() {
	setInterval(async () => {
		if (isAuthenticated()) {
			try {
				await apiFetch('/api/auth/me');
			} catch (error) {
				handleLogout();
			}
		}
	}, 60000); // Check every minute
}

// Call this when the app starts
document.addEventListener('DOMContentLoaded', () => {
	router();
	startTokenValidation();
});

// ─── RENDER ──────────────────────────────────────────────────────────────────
function render(html) {
	const app = document.getElementById('app');
	if (app) app.innerHTML = html;
}

// ─── VIEWS ────────────────────────────────────────────────────────────────────

function HomeView() {
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

		<div class="grid gap-6 md:grid-cols-2">
			<!-- Game section -->
			<div class="bg-white p-6 rounded-lg shadow-lg flex flex-col">
				<h2 class="text-2xl font-semibold text-indigo-600 mb-4">Available games</h2>
				<div id="games-list" class="flex-1 overflow-auto space-y-3"></div>
				<button id="newGameBtn"
								class="mt-4 px-4 py-2 bg-green-500 text-black rounded-lg hover:bg-green-600 transition">
					+ Create game
				</button>
			</div>

			<!-- Chat section -->
			<div class="bg-white p-6 rounded-lg shadow-lg flex flex-col">
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
						class="px-3 py-1 bg-indigo-100 text-indigo-600 rounded hover:bg-indigo-200 transition text-sm">+ Room</button>
					</div>
				</h2>
				<div class="flex-1 overflow-auto mb-4 flex">
					<!-- Room list -->
					<ul id="room-list" class="w-1/3 border-r border-gray-200 pr-4 space-y-2 overflow-auto">
						<!-- populated dynamically -->
					</ul>
					<!-- Messages -->
					<div class="w-2/3 pl-4 flex flex-col">
						<div id="chat" class="flex-1 overflow-auto space-y-2 mb-4"></div>
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


function LoginView() {
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

function RegisterView() {
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



function Setup2FAView(otpauth_url, base32) {
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

function Verify2FAView() {
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

function AccountView(user, friends = []) {
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
				<span class="flex-1 truncate">${friend.username}</span>
				<span class="flex gap-2">
					<button class="chat-friend-btn text-xl" data-username="${friend.username}" data-userid="${friend.userId}" title="Chat">💬</button>
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


// ─── ROUTER ──────────────────────────────────────────────────────────────────
async function router() {
	const path = window.location.pathname;

	// update nav before render -> to render either login/register or disconnect
	updateNav();

	switch (path) {
		case '/login':
			if (isAuthenticated()) {
				// If already authenticated, redirect to home
				history.pushState(null, '', '/');
				render(HomeView());
				setupHomeHandlers();
			} else {
				render(LoginView());
				setupLoginHandlers();
			}
			break;
		case '/register':
			if (isAuthenticated()) {
				history.pushState(null, '', '/');
				render(HomeView());
				setupHomeHandlers();
			} else {
				render(RegisterView());
				setupRegisterHandlers();
			}
			break;
		case '/account':
			if (!isAuthenticated()) {
			history.pushState(null, '', '/login');
			render(LoginView());
			setupLoginHandlers();
			} else {
			try {
				const user = await apiFetch('/api/users/me', { headers: { 'Authorization': `Bearer ${authToken}` } });
				const friends = await apiFetch('/api/friends', { headers: { 'Authorization': `Bearer ${authToken}` } });
				render(AccountView(user, friends));
				setupAccountHandlers(user);
			} catch (e) {
				showNotification({ message: 'Error during account loading.', type: 'error', duration: 5000 });
				history.pushState(null, '', '/');
				router();
			}
			}
			break;
		default:
			render(HomeView());
			if (isAuthenticated()) {
				setupHomeHandlers();
				currentRoom = 0;
				initWebSocket();
			}
			break;
	}
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Read cookie's userId
function getUserIdFromCookie() {
	try {
		const cookies = document.cookie.split(';');
		for (const cookie of cookies) {
			const [name, value] = cookie.trim().split('=');
			if (name === 'userId') {
				console.log('Found userId cookie:', value); // Debug log
				const userId = Number(value);
				if (!isNaN(userId)) {
					return userId;
				}
			}
		}
		console.log('No userId cookie found in:', document.cookie); // Debug log
	} catch (error) {
		console.error('Error parsing userId cookie:', error);
	}
	return null;
}

// ─── API FETCH ─────────────────────────────────────────────────────────
async function apiFetch(url, options = {}) {
	try {
		// Add /api prefix if not present
		const apiUrl = url.startsWith('/api') ? url : `/api${url}`;
		
		const headers = {
			...options.headers
		};
		
		if (options.body) {
			headers['Content-Type'] = 'application/json';
		}

		const response = await fetch(apiUrl, {
			...options,
			headers
		});
		
		if (response.status === 401) {
			handleLogout();
			throw new Error('Session expired. Please log in again.');
		}
		
		const data = await response.json();
		
		if (!response.ok) {
			throw new Error(data.error || 'An error has occured');
		}
		
		return data;
	} catch (error) {
		console.error('apiFetch error:', error);
		throw error;
	}
}

// ─── NAVIGATION HELPERS ──────────────────────────────────────────────────────
document.addEventListener('click', e => {
	const a = e.target.closest('a[data-link]');
	if (!a) return;
	e.preventDefault();
	history.pushState(null, '', a.pathname);
	router();
});
window.addEventListener('popstate', () => { router(); });
window.addEventListener('DOMContentLoaded', () => { router(); });

document.addEventListener('DOMContentLoaded', () => {
	router();
});
document.addEventListener('click', e => {
	const a = e.target.closest('a[data-link]');
	if (!a) return;
	e.preventDefault();
	history.pushState(null, '', a.pathname);
	router();
});

// ─── NAV UPDATE ──────────────────────────────────────────────────────────────

// update nav before render -> to render either login/register or disconnect
function updateNav() {
	const authNav = document.getElementById('auth-nav');
	if (!authNav) return;
	authToken = localStorage.getItem('token');
	if (!isAuthenticated()) {
		authNav.innerHTML = `
			<a href="/register" data-link
				 class="px-4 py-2 border border-indigo-600 text-indigo-600 rounded hover:bg-indigo-50 transition">
				Register
			</a>
			<a href="/login" data-link
				 class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition">
				Login
			</a>
		`;
	} else {
		authNav.innerHTML = `
			<a href="/account" data-link
				 class="px-4 py-2 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition font-semibold mr-2">
				Account
			</a>
			<button id="logoutNavBtn"
							class="px-4 py-2 bg-red-500 text-black rounded hover:bg-red-600 transition">
				Disconnect
			</button>
		`;
		document.getElementById('logoutNavBtn').addEventListener('click', () => {
			localStorage.removeItem('token');
			localStorage.removeItem('username');
			authToken = null;
			history.pushState(null, '', '/');
			router();
		});
	}
}

// ─── HANDLERS ────────────────────────────────────────────────────────────────
let loadRooms;
function setupHomeHandlers() {
	// Logout button
	const logoutBtn = document.getElementById('logoutBtn');
	if (logoutBtn) {
		logoutBtn.addEventListener('click', () => {
			localStorage.removeItem('token');
			localStorage.removeItem('username');
			authToken = null;
			history.pushState(null, '', '/');
			router();
		});
	}
	// "Create game" button -> a modifier pour integrer le jeu
	const newGameBtn = document.getElementById('newGameBtn');
	if (newGameBtn) {
		newGameBtn.addEventListener('click', () => {
			// call API to create a new game soon inshallah
			console.log('Create new game clicked');
		});
	}

  // Load rooms immediately when entering home view
	loadRooms = async () => {
		try {
			const rooms = await apiFetch('/api/chat/rooms/mine', { 
				headers: { 'Authorization': `Bearer ${authToken}` } 
			});
			const ul = document.getElementById('room-list');
			if (!ul) return;
			
			ul.innerHTML = rooms.map(r => 
				`<li data-id="${r.roomID}" class="group flex justify-between items-center cursor-pointer hover:bg-gray-100 p-2 rounded ${currentRoom === r.roomID ? 'bg-indigo-100' : ''}">
				<span class="flex-1 truncate">${r.name || `Room #${r.roomID}`}</span>
				<div class="flex gap-1 opacity-0 group-hover:opacity-100 transition">
					<button data-room="${r.roomID}" class="invite-room-btn text-green-600 hover:text-green-800 text-sm">➕</button>
					${r.ownerID === userId ? 
						`<button data-room="${r.roomID}" class="delete-room-btn text-red-600 hover:text-red-800 text-sm">❌</button>` : 
						''}
				</div>
				</li>`
			).join('');
			
			// If no room is selected, select general
			if (currentRoom === 0 && rooms.length > 0) {
				currentRoom = rooms[0].roomID;
			}
			
			// Event listeners
			document.querySelectorAll('#room-list li').forEach(li => {
				li.addEventListener('click', () => selectRoom(Number(li.dataset.id)));
			});

			// Delete Room Button
			document.querySelectorAll('.delete-room-btn').forEach(btn => {
				btn.addEventListener('click', async (e) => {
					e.stopPropagation(); // Prevent clicking
					const roomId = btn.dataset.room;
					showNotification({
						message: 'Delete this room?',
						type: 'confirm',
						onConfirm: async () => {
							try {	
							const response = await fetch('/api/auth/me', {
							headers: {
								'Authorization': `Bearer ${authToken}`
							}
							});
							if (!response.ok) {
								throw new Error('Failed to get userId');
							}
							const data = await response.json();
							const userId = data.userId
								//logic -> looks all members of the room and keep them
								const roomMembers= await apiFetch(`/api/chat/rooms/${roomId}/members`) 
								await apiFetch(`/api/chat/rooms/${roomId}`, {
									method: 'DELETE',
									headers: { 'Authorization': `Bearer ${authToken}` }
								});
								//then -> for each members send 'loadChatRooms' event
								for(const member of roomMembers){
									socket.send(JSON.stringify({
										type: 'loadChatRooms',
										roomID : roomId,
										userID : userId,
										newUser: member.userID
								}));
								}
								
								await loadRooms();
							} catch (err) {
								showNotification({ message: 'Error during delete.', type: 'error', duration: 5000 });
							}
						},
						onCancel: () => {
							console.log('Room deletion cancelled');
						}
					});
				});
			});
			// Add user in room button
			document.querySelectorAll('.invite-room-btn').forEach(btn => {
				btn.addEventListener('click', async (e) => {
				e.stopPropagation(); // Prevent clicking

				const roomId = btn.dataset.room;

				// Prompt notification
				showNotification({
					message: 'Type a User to add to the room :',
					type: 'prompt',
					placeholder: 'Username',
					onConfirm: async (val) => {
					const username = val;

					if (!username) return;

					try {
						const userIdToInvite = await getUserIdByUsername(username);

						await apiFetch(`/api/chat/rooms/${roomId}/members`, {
						method: 'POST',
						headers: {
							'Authorization': `Bearer ${authToken}`,
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({ userId: userIdToInvite })
						});
						const response = await fetch('/api/auth/me', {
						headers: {
							'Authorization': `Bearer ${authToken}`
						}
						});

						if (!response.ok) {
							throw new Error('Failed to get userId');
						}
						const data = await response.json();
						userId = data.userId
						socket.send(JSON.stringify({
							type: 'loadChatRooms',
							roomID : roomId,
							userID : userId,
							newUser: userIdToInvite
						}))
						alert(`User ${username} added successfully`);
						showNotification({ message: `User ${username} added successfully`, type: 'success' });
					} catch (err) {
						showNotification({ message: `Error while inviting : ${err.message}`, type: 'error', duration: 5000 });
					}
					}
				});
				});
			});


			// Load current room history
			if (socket && socket.readyState === WebSocket.OPEN) {
				socket.send(JSON.stringify({
					type: 'chatHistory',
					roomID: currentRoom,
					limit: 50
				}));
			}
		} catch (error) {
			console.error('Error loading rooms:', error);
			const ul = document.getElementById('room-list');
			if (ul) {
				ul.innerHTML = '<li class="text-red-500">Room loading error</li>';
			}
		}
	};

	// Call loadRooms immediately and set up WebSocket
	if (authToken) {
		loadRooms();
		initWebSocket();
	}

	// Chat: button to get back to general chat
	const generalChatBtn = document.getElementById('generalChatBtn');
	if (generalChatBtn) {
		generalChatBtn.addEventListener('click', () => {
			selectRoom(0); // Select room 0 aka general chat
			
			// Visual update on room list
			document.querySelectorAll('#room-list li').forEach(li => {
				li.classList.remove('bg-indigo-100');
				if (li.dataset.id === '0') {
					li.classList.add('bg-indigo-100');
				}
			});
		});
	}

	// Chat: New room
	const newChatRoomBtn = document.getElementById('newChatRoomBtn');
	if (newChatRoomBtn) {
		newChatRoomBtn.addEventListener('click', async () => {
		try {
			showNotification({
			message: "Room's name :",
			type: 'prompt',
			placeholder: 'New room',
			onConfirm: async (roomName) => {
				roomName = roomName || 'New room';
				const newRoom = await apiFetch('/api/chat/rooms', { 
				method: 'POST', 
				headers: { 
					'Authorization': `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ name: roomName })
				});
				addMemberToRoom(newRoom.roomID, userId);
				await loadRooms(); // Reload room list after creating one
			}
			});
		} catch (error) {
			console.error('Error creating chat room:', error);
			showNotification({ message: 'Error creating chat room: ' + error.message, type: 'error', duration: 5000 });
		}
		});
	}

	async function addMemberToRoom(roomId, userIdToAdd) {
		try {
			await apiFetch(`/api/chat/rooms/${roomId}/members`, {
				method: 'POST',
				headers: { 
					'Authorization': `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ userId: userIdToAdd })
			});
			const response = await fetch('/api/auth/me', {
			headers: {
				'Authorization': `Bearer ${authToken}`
			}
			});

			if (!response.ok) {
				throw new Error('Failed to get userId');
			}
			const data = await response.json();
			userId = data.userId
			socket.send(JSON.stringify({
				type: 'loadChatRooms',
				roomID : roomId,
				userID : userId,
				newUser: userIdToAdd
			}))
		} catch (error) {
			console.error('Error adding member :', error);
		}
	}

	// Chat: Select room
	const selectRoom = async (roomId) => {
		try {
			currentRoom = roomId;
			const chatDiv = document.getElementById('chat');
			if (!chatDiv) return;
			
			chatDiv.innerHTML = '<p class="text-gray-500">Chargement des messages...</p>';
			
			// Get history
			if (socket && socket.readyState === WebSocket.OPEN) {
				socket.send(JSON.stringify({
					type: 'chatHistory',
					roomID: roomId,
					limit: 50
				}));
			}
			document.querySelectorAll('#room-list li').forEach(li => {
				if (Number(li.dataset.id) === roomId) {
					li.classList.add('bg-indigo-100');
					const dot = li.querySelector('.unread-dot');
							if (dot) dot.remove();
				} else {
					li.classList.remove('bg-indigo-100');
				}
			});
		} catch (error) {
			console.error('Error selecting room:', error);
			const chatDiv = document.getElementById('chat');
			if (chatDiv) {
				chatDiv.innerHTML = '<p class="text-red-500">Error loading messages</p>';
			}
		}
	};

	// Chat: form submission via WebSocket
	const chatForm = document.getElementById('chatForm');
	if (chatForm) {
		chatForm.addEventListener('submit', e => {
			e.preventDefault();
			const formData = new FormData(chatForm);
			const content = formData.get('message');
			if (!content || !socket || socket.readyState !== WebSocket.OPEN) return;

			socket.send(JSON.stringify({
				type : 'chatRoomMessage',
				chatRoomID: currentRoom,
				userID: userId,
				content: content
			}));

			chatForm.reset();
		});
	}
	// Searchbar and add friend/block/unblock actions
	const userActionInput = document.getElementById('userActionInput');
	const addFriendBtn = document.getElementById('addFriendBtn');
	const blockUserBtn = document.getElementById('blockUserBtn');
	const unblockUserBtn = document.getElementById('unblockUserBtn');

	// Generic add / block / unblock function
	async function actionOnUser({ url, method = 'POST', successMsg, errorMsg }) {
		const username = userActionInput.value.trim();
		if (!username) 
			return showNotification({ message: 'Please type a Username', type: 'error' });
		try {
			const userId = await getUserIdByUsername(username);

			const result = await apiFetch(url.replace(':userId', userId), {
				method,
				headers: { 'Authorization': `Bearer ${authToken}` }
			});

			if (result.success) {
				showNotification({ message: successMsg, type: 'success' });
			} else {
				showNotification({ message: errorMsg, type: 'error', duration: 5000 });
			}
		} catch (e) {
			showNotification({ message: errorMsg + ' (' + e.message + ')', type: 'error', duration: 5000 });
		}
	}

	async function getUserIdByUsername(username) {
		if (!username) throw new Error("Username empty");
		try {
			const response = await fetch(`/api/users/by-username/${encodeURIComponent(username)}`, {
				headers: { 'Authorization': `Bearer ${authToken}` }
			});
			
			if (!response.ok) {
				if (response.status === 404) {
					throw new Error("User not found");
				}
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			
			const data = await response.json();
			if (!data.userId) throw new Error("User not found");
			return data.userId;
		} catch (error) {
			console.error('Error getting user ID:', error);
			throw error;
		}
	}

	// Add friend
	if (addFriendBtn) addFriendBtn.onclick = () =>
		actionOnUser({
		url: '/api/friends/:userId',
		method: 'POST',
		successMsg: "Friend added !",
		errorMsg: "Error during add"
		});

	// Block user
	if (blockUserBtn) blockUserBtn.onclick = () =>
		actionOnUser({
		url: '/api/blocks/:userId',
		method: 'POST',
		successMsg: "User blocked !",
		errorMsg: "Error during block"
		});

	// Unblock user
	if (unblockUserBtn) unblockUserBtn.onclick = () =>
		actionOnUser({
		url: '/api/blocks/:userId',
		method: 'DELETE',
		successMsg: "User unblocked !",
		errorMsg: "Error during unblock"
		});
}



function setupRegisterHandlers() {
	const form = document.getElementById('registerForm');
	if (!form) return;
	form.onsubmit = async e => {
		e.preventDefault();
		const data = Object.fromEntries(new FormData(form).entries());
		try {
			const res = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
			const json = await res.json();
			if (res.ok) {
				history.pushState(null, '', '/login');
				router();
			} else {
				const err = document.getElementById('register-error');
				err.textContent = json.error;
				err.classList.remove('hidden');
			}
		} catch {
			const err = document.getElementById('register-error');
			err.textContent = 'Register Error';
			err.classList.remove('hidden');
		}
	};
}

function setupLoginHandlers() {
	const form = document.getElementById('loginForm');
	if (!form) return;

	form.onsubmit = async e => {
		e.preventDefault();
		const data = Object.fromEntries(new FormData(form).entries());
		localStorage.setItem('username', data.username);

		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
			const json = await res.json();

			if (res.ok) {
				if (json.need2FASetup) {
					console.log('2FA setup needed, token received:', json.token);
					pendingToken = json.token;
					await doSetup2FA(pendingToken);
				} else if (json.need2FAVerify) {
					console.log('2FA verification needed');
					pendingToken = json.token;
					render(Verify2FAView());
					setupVerify2FAHandlers();
				} else {
					localStorage.setItem('token', json.token);
					authToken = json.token;
					history.pushState(null, '', '/');
					router();
				}
			} else {
				console.error('Login failed:', json.error);
				const err = document.getElementById('login-error');
				err.textContent = json.error || 'Login Error';
				err.classList.remove('hidden');
			}
		} catch (err) {
			console.error('Login error:', err);
			const errEl = document.getElementById('login-error');
			errEl.textContent = 'Network Error';
			errEl.classList.remove('hidden');
		}
	};
}



async function doSetup2FA(token) {
	if (!token) {
		console.error('No token provided for 2FA setup');
		return;
	}

	try {
		console.log('Sending 2FA setup request with token:', token);
		const res = await fetch('/api/auth/2fa/setup', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({})
		});
		
		if (!res.ok) {
			const errorData = await res.json();
			throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
		}
		
		const json = await res.json();
		console.log('2FA setup response:', json);
		
		if (!json.otpauth_url || !json.base32) {
			throw new Error('Invalid server response: missing required 2FA data');
		}
		
		render(Setup2FAView(json.otpauth_url, json.base32));
		setupSetup2FAHandlers(); // Utiliser la fonction existante
	} catch (err) {
		console.error('2FA setup error:', err);
		render(`
			<div class="max-w-md mx-auto mt-12 bg-white p-8 rounded shadow">
				<p class="text-red-500">Impossible to config 2fa, Err : ${err.message}</p>
				<button id="back-login" class="mt-4 w-full py-2 px-4 bg-indigo-600 text-black rounded">
					Retour
				</button>
			</div>
		`);
		document.getElementById('back-login')
			.addEventListener('click', () => { 
				history.pushState(null,'','/login'); 
				router(); 
			});
	}
}

function setupSetup2FAHandlers() {
	const btn = document.getElementById('verify-setup-2fa-btn');
	if (!btn) return;
	btn.onclick = async () => {
		const code = document.getElementById('2fa-setup-code').value;
		try {
			const res = await fetch('/api/auth/2fa/verify', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${pendingToken}`
				},
				body: JSON.stringify({ code })
			});
			const json = await res.json();
			if (res.ok) {
				localStorage.setItem('token', json.token);
				authToken = json.token;
				window.location.href = '/';
			} else {
				const err = document.getElementById('setup2fa-error');
				err.textContent = json.error;
				err.classList.remove('hidden');
			}
		} catch {
			showNotification({ message: 'Error during 2fa verification', type: 'error', duration: 5000 });
		}
	};
}

function setupVerify2FAHandlers() {
	const form = document.getElementById('verifyForm');
	if (!form) return;
	form.onsubmit = async e => {
		e.preventDefault();
		const code = document.getElementById('2fa-code').value;
		try {
			const res = await fetch('/api/auth/2fa/verify', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${pendingToken}`
				},
				body: JSON.stringify({ code })
			});
			const json = await res.json();
			if (res.ok) {
				localStorage.setItem('token', json.token);
				authToken = json.token;
				
				// Rediriger vers la page d'accueil
				history.pushState(null, '', '/');
				router();
			} else {
				const err = document.getElementById('verify-error');
				err.textContent = json.error;
				err.classList.remove('hidden');
			}
		} catch {
			showNotification({ message: 'Error during 2fa verification', type: 'error', duration: 5000 });
		}
	};
}


function setupAccountHandlers(user) {
	// Back to home
	const backBtn = document.getElementById('backHomeBtn');
	if (backBtn) {
		backBtn.onclick = () => {
			history.pushState(null, '', '/');
			router();
		};
	}
	// Click on avatar to load image
	const avatarImg = document.getElementById('account-avatar');
	const avatarInput = document.getElementById('avatarInput');
	avatarImg.onclick = () => avatarInput.click();
	avatarInput.onchange = async (e) => {
	const file = e.target.files[0];
	if (!file) return;
	// Instant preview
	const reader = new FileReader();
	reader.onload = (ev) => { avatarImg.src = ev.target.result; };
	reader.readAsDataURL(file);

	// Send FormData to server
	const formData = new FormData();
	formData.append('avatar', file);
	const res = await fetch('/api/users/me/avatar', {
		method: 'POST',
		headers: { 'Authorization': `Bearer ${authToken}` },
		body: formData,
	});
	if (!res.ok) 
		showNotification({ message: 'Error during avatar uploading !', type: 'error', duration: 5000 });
	};

	// Password
	document.getElementById('profileForm').onsubmit = async e => {
	e.preventDefault();
	const pwd = document.getElementById('newPassword').value;
	if (!pwd) return showNotification({ message: 'New password needed !', type: 'error', duration: 5000 });
	try {
		const res = await fetch('/api/users/me/password', {
		method: 'POST',
		headers: { 
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${authToken}`,
		},
		body: JSON.stringify({ newPassword: pwd }),
		});
		if (res.ok) showNotification({ message: 'Password modified successfully!', type: 'success' });
		else showNotification({ message: 'Error during password modification', type: 'error', duration: 5000 });
	} catch { showNotification({ message: 'Network Error', type: 'error', duration: 5000 })};
	};


	// (Re)Setup 2FA
	document.getElementById('setup2faBtn').onclick = async () => {
		try {			//Test to update chatRooms 
			const response = await fetch('/api/auth/me', {
			headers: {
				'Authorization': `Bearer ${authToken}`
			}
			});

			if (!response.ok) {
				throw new Error('Failed to get userId');
			}
			// Call the reconfigure2FA function to start the 2FA setup process
			await reconfigure2FA();
		} catch (error) {
			showNotification({ message: 'Error during 2FA reconfiguration' + error, type: 'error', duration: 5000 });
		}
	};

	// Function to trigger the 2FA reconfiguration process
	async function reconfigure2FA() {
			try {
					const response = await fetch('/api/auth/2fa/reconfigure', {
							method: 'POST',
							headers: {
									'Authorization': `Bearer ${authToken}`,
									'Content-Type': 'application/json'
							}
					});

					const data = await response.json();
					if (response.ok) {
							// Store the temporary setup token
							pendingToken = data.token;
							
							// Show the QR code setup view
							render(Setup2FAView(data.otpauth_url, data.base32));
							setupSetup2FAHandlers();
					} else {
							// Handle specific error cases
							if (data.need2FASetup) {
									showNotification({ 
											message: '2FA must be enabled first before reconfiguring', 
											type: 'error', 
											duration: 5000 
									});
							} else {
									showNotification({ 
											message: data.error || 'Failed to reconfigure 2FA', 
											type: 'error', 
											duration: 5000 
									});
							}
					}
			} catch (error) {
					console.error('Error during 2FA reconfiguration:', error);
					showNotification({ 
							message: 'Error during 2FA reconfiguration', 
							type: 'error', 
							duration: 5000 
					});
			}
	}

	// Direct Messages
	document.querySelectorAll('.chat-friend-btn').forEach(btn => {
		btn.onclick = async () => {
		const friendUsername = btn.dataset.username;
		const usernames = [user.username, friendUsername].sort();
		const roomName = `${usernames[0]} | ${usernames[1]}`;
		try {
			// Create room
			const room = await apiFetch('/api/chat/rooms/dm', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${authToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ name: roomName })
			});

			// Get friend's user id
			const friendUserId = await apiFetch(`/users/by-username/${encodeURIComponent(friendUsername)}`, {
			headers: { 'Authorization': `Bearer ${authToken}` }
			}).then(data => data.userId);

			// Add friend to room
			await apiFetch(`/api/chat/rooms/${room.roomID}/members`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${authToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ userId: friendUserId })
			});

			// Add user to room
			await apiFetch(`/api/chat/rooms/${room.roomID}/members`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${authToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ userId: user.userId })
			});
			//Test to update chatRooms 
			const response = await fetch('/api/auth/me', {
			headers: {
				'Authorization': `Bearer ${authToken}`
			}
			});

			if (!response.ok) {
				throw new Error('Failed to get userId');
			}
			const data = await response.json();
			userId = data.userId
			socket.send(JSON.stringify({
				type: 'loadChatRooms',
				roomID : room.roomID,
				userID : userId,
				newUser: friendUserId
			}))
			const selectRoom = async (roomId) => {
			try {
				currentRoom = roomId;
				const chatDiv = document.getElementById('chat');
				if (!chatDiv) return;
				
				chatDiv.innerHTML = '<p class="text-gray-500">Chargement des messages...</p>';
				
				// Get history
				if (socket && socket.readyState === WebSocket.OPEN) {
					socket.send(JSON.stringify({
						type: 'chatHistory',
						roomID: roomId,
						limit: 50
					}));
				}
				
				// Update visually the selected room
				// Update visually the selected room
			
				document.querySelectorAll('#room-list li').forEach(li => {
					if (Number(li.dataset.id) === roomId) {
						const dot = li.querySelector('.unread-dot');
							if (dot) dot.remove();
						li.classList.add('bg-indigo-100');
					} else {
						li.classList.remove('bg-indigo-100');
					}
				});
			} catch (error) {
				console.error('Error selecting room:', error);
				const chatDiv = document.getElementById('chat');
				if (chatDiv) {
					chatDiv.innerHTML = '<p class="text-red-500">Error loading messages</p>';
				}
			}
		};
			// Selectroom
			selectRoom(room.roomID);
			history.pushState(null, '', '/');
			router();
			showNotification({ message: `Room "${roomName}" created with ${friendUsername}`, type: 'success' });


		} catch (e) {
			showNotification({ message: 'Error while creating the room: ' + e.message, type: 'error', duration: 5000 });
		}
		};
	});
	// Other's profiles (to implement)
	document.querySelectorAll('.profile-friend-btn').forEach(btn => {
	btn.onclick = () => {
		const friendUsername = btn.dataset.username;
		alert(`Voir le profil de ${friendUsername} (à implémenter)`);
		// future: history.pushState() + router pour aller sur /profile/:username
	};
	});

	// Remove friend
	document.querySelectorAll('.remove-friend-btn').forEach(btn => {
		btn.onclick = async () => {
			const friendUsername = btn.dataset.username;
			const friendUserId = await apiFetch(`/users/by-username/${encodeURIComponent(friendUsername)}`, {
				headers: { 'Authorization': `Bearer ${authToken}` }
			}).then(data => data.userId);

			// Show confirmation notification before removing the friend
			showNotification({
				message: `Remove ${friendUsername} from your friends?`,
				type: 'confirm',
				onConfirm: async () => {
					try {
						await apiFetch(`/api/friends/${friendUserId}`, {
							method: 'DELETE',
							headers: { 'Authorization': `Bearer ${authToken}` }
						});
						showNotification({ message: `${friendUsername} removed from your friends`, type: 'success' });
						// Refresh account view
						history.pushState(null, '', '/account');
						router();
					} catch (e) {
						showNotification({ message: 'Error removing friend : ' + e.message, type: 'error', duration: 5000 });
					}
				},
				onCancel: () => {
					console.log(`Friend removal for ${friendUsername} was cancelled.`);
				}
			});
		};
	});
}



// ─── WEBSOCKETS ────────────────────────────────────────────────────────────────


// Initialize WS if both userId and authtoken are setup
async function initWebSocket() {
	if (!isAuthenticated()) {
		console.warn('WebSocket: pas de token d\'authentification');
		return;
	}

	try {
		// Get userId via API
		const response = await fetch('/api/auth/me', {
			headers: {
				'Authorization': `Bearer ${authToken}`
			}
		});

		if (!response.ok) {
			throw new Error('Failed to get userId');
		}

		const data = await response.json();
		userId = data.userId;

		if (!userId) {
			console.warn('WebSocket: userId non obtenu');
			return;
		}

		const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
		const wsUrl = `${protocol}://${location.host}/ws?token=${encodeURIComponent(authToken)}`;

		// Close old socket if already open
		if (socket && socket.readyState === WebSocket.OPEN) {
			socket.close();
		}

		socket = new WebSocket(wsUrl);

		socket.onopen = () => {
			setTimeout(() => {
				if (socket.readyState === WebSocket.OPEN) {
					socket.send(JSON.stringify({
						type: 'chatHistory',
						roomID: currentRoom,
						limit: 50
					}));
				}
			}, 100);
		};

		socket.onmessage = (event) => {
			console.log('Message brut reçu du WebSocket:', event.data);
			try {
				const parsed = JSON.parse(event.data);
				handleWebSocketMessage(parsed);
			} catch (e) {
				console.error('Websocket message parsing error:', e);
			}
		};

		socket.onclose = (event) => {
			console.log('WebSocket disconnected:', event.code, event.reason);
		};

		socket.onerror = (error) => {
			console.error('WebSocket Error:', error);
		};
	} catch (error) {
		console.error('Error during WebSocket init:', error);
	}
}


// Auxilliary function to handle websocket messages
function handleWebSocketMessage(msg) {
	const chatDiv = document.getElementById('chat');
	if (!chatDiv) return;

	const MESSAGE_LIMIT = 15;

	switch (msg.type) {
		case 'system':
			const systemMsg = document.createElement('p');
			systemMsg.className = 'italic text-gray-500';
			systemMsg.textContent = msg.message;
			chatDiv.appendChild(systemMsg);
			break;
			
		case 'chatRoomMessage':
			if (msg.roomID === currentRoom) {
				appendMessageToChat(chatDiv, {
					isOwnMessage: msg.from === userId,
					name: msg.from === userId ? 'Moi' : msg.name_from,
					content: msg.content
				});

				// Keep only the last 15
				while (chatDiv.children.length > MESSAGE_LIMIT) {
					chatDiv.removeChild(chatDiv.firstChild);
				}
			}
			else {
				console.log('THERE S A SHIT IF YOU DON:T SEE ME IN DM ?')
				const handleUnread = async(msg) => {
					try {
						if(msg.roomID === 0)
							return;
						
						// Get list of rooms the user is currently a member of
						const userRooms = await apiFetch('/api/chat/rooms/mine', {
							headers: { 'Authorization': `Bearer ${authToken}` }
						});

						// Check if the incoming message belongs to one of these rooms
						const isMessageForMyRoom = userRooms.some(room => room.roomID === msg.roomID);

						if (isMessageForMyRoom) {
							// Find the room element in the UI
							const roomListItem = document.querySelector(`#room-list li[data-id="${msg.roomID}"]`);
							if (!roomListItem) {
								console.log('UNABLE to resolve :', msg.roomID);
							return;
							}
							console.log('ABLE to resolve:', msg.roomID);
							// Target the name span (where you want to append the dot)
							const roomNameSpan = roomListItem.querySelector('span');
							if (!roomNameSpan) {
								console.log('ROOM NAME SPAN EMPTY');
								return;
							}

							// Check if there's already a red dot <span> in the name span
							const alreadyHasDot = [...roomNameSpan.children].some(child =>
								child.tagName === 'SPAN' && child.dataset.dot === 'true'
							);

							if (!alreadyHasDot) {
								const redDot = document.createElement('span');
								redDot.dataset.dot = 'true'; // ← THIS makes detection reliable
								redDot.style.width = '0.5rem';
								redDot.style.height = '0.5rem';
								redDot.style.backgroundColor = 'red';
								redDot.style.borderRadius = '9999px';
								redDot.style.marginLeft = '0.5rem';
								redDot.style.display = 'inline-block';

								roomNameSpan.appendChild(redDot);
							}
						}
						else {
							console.log('is this Message is not for me ?');
						}
					}
					catch (err) {
						console.error('Error while marking room as unread:', err);
					}
				}
				handleUnread(msg);
			}
			break;

		case 'chatHistory':
			if (msg.roomID === currentRoom && Array.isArray(msg.messages)) {
				chatDiv.innerHTML = ''; // empty chat
				
				// Get the last 15 messages from history
				const recentMessages = msg.messages
					.slice(-MESSAGE_LIMIT);
				
				// Render messages in chronologic order
				recentMessages.forEach(historyMsg => {
					appendMessageToChat(chatDiv, {
						isOwnMessage: historyMsg.from === userId,
						name: historyMsg.from === userId ? 'Moi' : historyMsg.name_from,
						content: historyMsg.content
					});
				});
			}
			break;
		case 'loadChatRooms':
			//if(msg.roomID !== currentRoom){
				if(msg.newUser === userId){
					loadRooms();
				}
			//}
			break;
		default:
			console.warn('Type de message WebSocket non géré:', msg.type);
	}
}

// Auxillary function to append a message to chat
function appendMessageToChat(chatDiv, { isOwnMessage, name, content }) {
	const messageP = document.createElement('p');
	messageP.className = isOwnMessage ? 'text-right mb-1' : 'text-left mb-1';

	const prefixSpan = document.createElement('span');
	prefixSpan.className = isOwnMessage ? 'text-green-600 font-semibold' : 'text-blue-600 font-semibold';
	prefixSpan.textContent = `${name}: `;

	const contentSpan = document.createElement('span');
	contentSpan.className = 'text-gray-800';
	contentSpan.textContent = content;

	messageP.appendChild(prefixSpan);
	messageP.appendChild(contentSpan);
	chatDiv.appendChild(messageP);
}


// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────────

function getNotificationContainer() {
	let container = document.getElementById('notif-container');
	if (!container) {
	container = document.createElement('div');
	container.id = 'notif-container';
	container.className = 'fixed top-5 right-5 flex flex-col space-y-3 z-50';
	document.body.appendChild(container);
	}
	return container;
}

function showNotification({
	message = '',
	type = 'info',       // success, error, info, warning, prompt, confirm
	duration = 3000,     // ignored if type === 'prompt' ou 'confirm'
	placeholder = '',    // only for prompt
	onConfirm = null,    // callback(value) for prompt
	onCancel = null,     // callback() for prompt
}) {
	if (type === 'prompt') {
		// Prompt
		const overlay = document.createElement('div');
		overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]';

		const modal = document.createElement('div');
		modal.className = 'bg-white rounded-lg p-6 max-w-sm w-full shadow-lg flex flex-col space-y-4';

		const msg = document.createElement('p');
		msg.className = 'text-gray-800 text-lg';
		msg.textContent = message;

		const input = document.createElement('input');
		input.type = 'text';
		input.placeholder = placeholder;
		input.className = 'border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500';

		const buttons = document.createElement('div');
		buttons.className = 'flex justify-end space-x-3';

		const btnCancel = document.createElement('button');
		btnCancel.textContent = 'Cancel';
		btnCancel.className = 'px-4 py-2 rounded bg-gray-300 hover:bg-gray-400 text-gray-800';
		btnCancel.onclick = () => {
			document.body.removeChild(overlay);
			if (onCancel) onCancel();
		};

		const btnOk = document.createElement('button');
		btnOk.textContent = 'Confirm';
		btnOk.className = 'px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white';
		btnOk.onclick = () => {
			const val = input.value;
			document.body.removeChild(overlay);
			if (onConfirm) onConfirm(val);
		};

		buttons.appendChild(btnCancel);
		buttons.appendChild(btnOk);

		modal.appendChild(msg);
		modal.appendChild(input);
		modal.appendChild(buttons);

		overlay.appendChild(modal);
		document.body.appendChild(overlay);

		input.focus();

		return; // prompt dont create normal notif
	}

	if (type === 'confirm') {
		// Confirmation
		const overlay = document.createElement('div');
		overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]';

		const modal = document.createElement('div');
		modal.className = 'bg-white rounded-lg p-6 max-w-sm w-full shadow-lg flex flex-col space-y-4';

		const msg = document.createElement('p');
		msg.className = 'text-gray-800 text-lg';
		msg.textContent = message;

		const buttons = document.createElement('div');
		buttons.className = 'flex justify-end space-x-3';

		const btnCancel = document.createElement('button');
		btnCancel.textContent = 'Cancel';
		btnCancel.className = 'px-4 py-2 rounded bg-gray-300 hover:bg-gray-400 text-gray-800';
		btnCancel.onclick = () => {
			document.body.removeChild(overlay);
			if (onCancel) onCancel();
		};

		const btnOk = document.createElement('button');
		btnOk.textContent = 'Confirm';
		btnOk.className = 'px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white';
		btnOk.onclick = () => {
			document.body.removeChild(overlay);
			if (onConfirm) onConfirm();
		};

		buttons.appendChild(btnCancel);
		buttons.appendChild(btnOk);

		modal.appendChild(msg);
		modal.appendChild(buttons);

		overlay.appendChild(modal);
		document.body.appendChild(overlay);

		return; // confirm dont create normal notif
	}

	// Normal notif
	const container = getNotificationContainer();

	const colors = {
		success: 'bg-green-500',
		error: 'bg-red-500',
		info: 'bg-blue-500',
		warning: 'bg-yellow-400 text-black',
	};

	const notif = document.createElement('div');
	notif.className = `
		max-w-xs w-full text-white px-4 py-3 rounded shadow-lg flex items-center space-x-3 cursor-pointer
		${colors[type] || colors.info}
		transform transition duration-300 ease-in-out
		hover:brightness-90
	`;

	notif.textContent = message;

	notif.addEventListener('click', () => {
		notif.remove();
	});

	container.appendChild(notif);

	notif.style.opacity = 0;
	notif.style.transform = 'translateX(100%)';
	setTimeout(() => {
		notif.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
		notif.style.opacity = 1;
		notif.style.transform = 'translateX(0)';
	}, 10);

	setTimeout(() => {
		notif.style.opacity = 0;
		notif.style.transform = 'translateX(100%)';
		setTimeout(() => {
			notif.remove();
		}, 300);
	}, duration);
}