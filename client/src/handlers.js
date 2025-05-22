import { HomeView, LoginView, RegisterView, AccountView, Setup2FAView, Verify2FAView, ProfileView, render } from './views.js';
import { isAuthenticated, apiFetch, initWebSocket, state } from './api.js';
import { showNotification } from './notifications.js';



// =======================
// TOKEN VALIDATION
// =======================

export function startTokenValidation() {
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

// =======================
// NAV UPDATE
// =======================

export function updateNav() {
	const authNav = document.getElementById('auth-nav');
	if (!authNav) return;
	let token = localStorage.getItem('token');
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
			// Mettre à jour le token global si besoin
			history.pushState(null, '', '/');
			router();
		});
	}
}

// =======================
// EXPORTABLE HELPERS
// =======================

export async function addMemberToRoom(roomId, userIdToAdd) {
	try {
		await apiFetch(`/api/chat/rooms/${roomId}/members`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${state.authToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ userId: userIdToAdd })
		});
		const response = await fetch('/api/auth/me', {
			headers: { 'Authorization': `Bearer ${state.authToken}` }
		});
		if (!response.ok) throw new Error('Failed to get userId');
		const data = await response.json();
		state.userId = data.userId;
		state.socket.send(JSON.stringify({
			type: 'loadChatRooms',
			roomID: roomId,
			userID: state.userId,
			newUser: userIdToAdd
		}));
	} catch (error) {
		console.error('Error adding member :', error);
	}
}

export async function actionOnUser({ url, method = 'POST', successMsg, errorMsg }) {
	const userActionInput = document.getElementById('userActionInput');
	const username = userActionInput.value.trim();
	if (!username)
		return showNotification({ message: 'Please type a Username', type: 'error' });
	try {
		const userId = await getUserIdByUsername(username);
		const result = await apiFetch(url.replace(':userId', userId), {
			method,
			headers: { 'Authorization': `Bearer ${state.authToken}` }
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

export async function getUserIdByUsername(username) {
	if (!username) throw new Error("Username empty");
	try {
		const response = await fetch(`/api/users/by-username/${encodeURIComponent(username)}`, {
			headers: { 'Authorization': `Bearer ${state.authToken}` }
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

export async function reconfigure2FA() {
	try {
		const response = await fetch('/api/auth/2fa/reconfig', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${state.authToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({})
		});
		const data = await response.json();
		if (response.ok) {
			// Store the temporary setup token
			state.pendingToken = data.token;
			render(Setup2FAView(data.otpauth_url, data.base32));
			setupSetup2FAHandlers();
		} else {
			if (data.need2FASetup) {
				showNotification({
					message: '2FA must be enabled first before reconfiguring',
					type: 'error',
					duration: 5000
				});
			} else {
				console.log('[DEBUG reconfigure2FA] data:', data);
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

// =======================
// HANDLERS
// =======================
let loadRooms;

export function setupHomeHandlers() {
	// Logout button
	const logoutBtn = document.getElementById('logoutBtn');
	if (logoutBtn) {
		logoutBtn.addEventListener('click', () => {
			localStorage.removeItem('token');
			localStorage.removeItem('username');
			history.pushState(null, '', '/');
			router();
		});
	}

	// "Create game" button
	const newGameBtn = document.getElementById('newGameBtn');
	if (newGameBtn) {
		newGameBtn.addEventListener('click', () => {
			console.log('Create new game clicked');
		});
	}

	// Load rooms immediately when entering home view
	loadRooms = async () => {
		try {
			const rooms = await apiFetch('/api/chat/rooms/mine', {
				headers: { 'Authorization': `Bearer ${state.authToken}` }
			});
			const ul = document.getElementById('room-list');
			if (!ul) return;

			ul.innerHTML = rooms.map(r =>
				`<li data-id="${r.roomID}" class="group flex justify-between items-center cursor-pointer hover:bg-gray-100 p-2 rounded ${state.currentRoom === r.roomID ? 'bg-indigo-100' : ''}">
				<span class="flex-1 truncate">${r.name || `Room #${r.roomID}`}</span>
				<div class="flex gap-1 opacity-0 group-hover:opacity-100 transition">
					<button data-room="${r.roomID}" class="invite-room-btn text-green-600 hover:text-green-800 text-sm">➕</button>
					${r.ownerID === state.userId ?
					`<button data-room="${r.roomID}" class="delete-room-btn text-red-600 hover:text-red-800 text-sm">❌</button>` :
					''}
				</div>
				</li>`
			).join('');

			// Get previously selected room
			let savedRoom = Number(localStorage.getItem('currentRoom') || 0);
			let validRoom = rooms.find(r => r.roomID === savedRoom);

			if (validRoom) {
				state.currentRoom = savedRoom;
			} else if (rooms.length > 0) {
				state.currentRoom = 0;
				localStorage.setItem('currentRoom', state.currentRoom);
			} else {
				state.currentRoom = 0;
			}

			// Event listeners for room selection
			document.querySelectorAll('#room-list li').forEach(li => {
				li.addEventListener('click', () => selectRoom(Number(li.dataset.id)));
			});

			// Delete Room Button
			document.querySelectorAll('.delete-room-btn').forEach(btn => {
				btn.addEventListener('click', async (e) => {
					e.stopPropagation();
					const roomId = btn.dataset.room;
					showNotification({
						message: 'Delete this room?',
						type: 'confirm',
						onConfirm: async () => {
							try {
								const response = await fetch('/api/auth/me', {
									headers: { 'Authorization': `Bearer ${state.authToken}` }
								});
								if (!response.ok) throw new Error('Failed to get userId');
								const data = await response.json();
								const userIdLocal = data.userId;
								const roomMembers = await apiFetch(`/api/chat/rooms/${roomId}/members`);
								await apiFetch(`/api/chat/rooms/${roomId}`, {
									method: 'DELETE',
									headers: { 'Authorization': `Bearer ${state.authToken}` }
								});
								for (const member of roomMembers) {
									state.socket.send(JSON.stringify({
										type: 'loadChatRooms',
										roomID: roomId,
										userID: userIdLocal,
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
					e.stopPropagation();
					const roomId = btn.dataset.room;
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
										'Authorization': `Bearer ${state.authToken}`,
										'Content-Type': 'application/json'
									},
									body: JSON.stringify({ userId: userIdToInvite })
								});
								const response = await fetch('/api/auth/me', {
									headers: { 'Authorization': `Bearer ${state.authToken}` }
								});
								if (!response.ok) throw new Error('Failed to get userId');
								const data = await response.json();
								state.userId = data.userId;
								state.socket.send(JSON.stringify({
									type: 'loadChatRooms',
									roomID: roomId,
									userID: state.userId,
									newUser: userIdToInvite
								}));
								showNotification({ message: `User ${username} added successfully`, type: 'success' });
							} catch (err) {
								showNotification({ message: `Error while inviting : ${err.message}`, type: 'error', duration: 5000 });
							}
						}
					});
				});
			});

			// Load current room history
			if (rooms.length > 0) {
				selectRoom(state.currentRoom);
			}
		} catch (error) {
			console.error('Error loading rooms:', error);
			const ul = document.getElementById('room-list');
			if (ul) {
				ul.innerHTML = '<li class="text-red-500">Room loading error</li>';
			}
		}
	};
	state.loadRooms = loadRooms;

	// Call loadRooms immediately and set up WebSocket
	if (state.authToken) {
		loadRooms();
		initWebSocket();
	}

	// General chat button
	const generalChatBtn = document.getElementById('generalChatBtn');
	if (generalChatBtn) {
		generalChatBtn.addEventListener('click', () => {
			selectRoom(0); // Select general chat
			document.querySelectorAll('#room-list li').forEach(li => {
				li.classList.remove('bg-indigo-100');
				if (li.dataset.id === '0') {
					li.classList.add('bg-indigo-100');
				}
			});
		});
	}

	// Create new chat room
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
								'Authorization': `Bearer ${state.authToken}`,
								'Content-Type': 'application/json'
							},
							body: JSON.stringify({ name: roomName })
						});
						addMemberToRoom(newRoom.roomID, state.userId);
						selectRoom(newRoom.roomID);
						await loadRooms();
					}
				});
			} catch (error) {
				console.error('Error creating chat room:', error);
				showNotification({ message: 'Error creating chat room: ' + error.message, type: 'error', duration: 5000 });
			}
		});
	}

	// Chat: select room function (helper interne)
	async function selectRoom(roomId) {
		try {
			state.currentRoom = roomId;
			localStorage.setItem('currentRoom', roomId);
			const chatDiv = document.getElementById('chat');
			if (!chatDiv) return;

			chatDiv.innerHTML = '<p class="text-gray-500">Chargement des messages...</p>';

			if (state.socket && state.socket.readyState === WebSocket.OPEN) {
				state.socket.send(JSON.stringify({
					type: 'chatHistory',
					roomID: roomId,
					limit: 50
				}));
			}
			document.querySelectorAll('#room-list li').forEach(li => {
				const roomNameSpan = li.querySelector('span.flex-1');
				if (roomNameSpan) {
					const dot = roomNameSpan.querySelector('.unread-dot');
					if (dot) dot.remove();
				}
				if (Number(li.dataset.id) === roomId) {
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
	}

	// Chat: form submission via WebSocket
	const chatForm = document.getElementById('chatForm');
	if (chatForm) {
		chatForm.addEventListener('submit', e => {
			e.preventDefault();
			const formData = new FormData(chatForm);
			const content = formData.get('message');
			if (!content || !state.socket || state.socket.readyState !== WebSocket.OPEN) return;

			state.socket.send(JSON.stringify({
				type: 'chatRoomMessage',
				chatRoomID: state.currentRoom,
				userID: state.userId,
				content: content
			}));
			chatForm.reset();
		});
	}

	// Add friend / block / unblock buttons (searchbar actions)
	const userActionInput = document.getElementById('userActionInput');
	const addFriendBtn = document.getElementById('addFriendBtn');
	const blockUserBtn = document.getElementById('blockUserBtn');
	const unblockUserBtn = document.getElementById('unblockUserBtn');

	if (addFriendBtn) addFriendBtn.onclick = () =>
		actionOnUser({
			url: '/api/friends/:userId',
			method: 'POST',
			successMsg: "Friend added !",
			errorMsg: "Error during add"
		});

	if (blockUserBtn) blockUserBtn.onclick = () =>
		actionOnUser({
			url: '/api/blocks/:userId',
			method: 'POST',
			successMsg: "User blocked !",
			errorMsg: "Error during block"
		});

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
					state.pendingToken = json.token;
					await doSetup2FA(state.pendingToken);
				} else if (json.need2FAVerify) {
					console.log('2FA verification needed');
					state.pendingToken = json.token;
					render(Verify2FAView());
					setupVerify2FAHandlers();
				} else {
					localStorage.setItem('token', json.token);
					state.authToken = json.token;
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
					Authorization: `Bearer ${state.pendingToken}`
				},
				body: JSON.stringify({ code })
			});
			const json = await res.json();
			if (res.ok) {
				localStorage.setItem('token', json.token);
				state.authToken = json.token;
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
					Authorization: `Bearer ${state.pendingToken}`
				},
				body: JSON.stringify({ code })
			});
			const json = await res.json();
			if (res.ok) {
				localStorage.setItem('token', json.token);
				state.authToken = json.token;
				
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


function setupAccountHandlers(user, friends = []) {
	// Back to home
	const backBtn = document.getElementById('backHomeBtn');
	if (backBtn) {
		backBtn.onclick = () => {
			if (state.socket && state.socket.readyState === WebSocket.OPEN) {
			    state.socket.close();
			    state.socket = null;
			}
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
		headers: { 'Authorization': `Bearer ${state.authToken}` },
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
			'Authorization': `Bearer ${state.authToken}`,
		},
		body: JSON.stringify({ newPassword: pwd }),
		});
		if (res.ok) showNotification({ message: 'Password modified successfully!', type: 'success' });
		else showNotification({ message: 'Error during password modification', type: 'error', duration: 5000 });
	} catch { showNotification({ message: 'Network Error', type: 'error', duration: 5000 })};
	};


	// (Re)Setup 2FA
	document.getElementById('setup2faBtn').onclick = async () => {
		try {
			const response = await fetch('/api/auth/me', {
			headers: {
				'Authorization': `Bearer ${state.authToken}`
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
					const response = await fetch('/api/auth/2fa/reconfig', {
							method: 'POST',
							headers: {
									'Authorization': `Bearer ${state.authToken}`,
									'Content-Type': 'application/json'
							},
							body: JSON.stringify({})
					});

					const data = await response.json();
					if (response.ok) {
							// Store the temporary setup token
							state.pendingToken = data.token;
							
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
									console.log('[DEBUG reconfigure2FA] data:', data);
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
				'Authorization': `Bearer ${state.authToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ name: roomName })
			});

			// Get friend's user id
			const friendUserId = await apiFetch(`/users/by-username/${encodeURIComponent(friendUsername)}`, {
			headers: { 'Authorization': `Bearer ${state.authToken}` }
			}).then(data => data.userId);

			// Add friend to room
			await apiFetch(`/api/chat/rooms/${room.roomID}/members`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${state.authToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ userId: friendUserId })
			});

			// Add user to room
			await apiFetch(`/api/chat/rooms/${room.roomID}/members`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${state.authToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ userId: user.userId })
			});
			//Test to update chatRooms 
			const response = await fetch('/api/auth/me', {
			headers: {
				'Authorization': `Bearer ${state.authToken}`
			}
			});

			if (!response.ok) {
				throw new Error('Failed to get userId');
			}
			const data = await response.json();
			state.userId = data.userId
			state.socket.send(JSON.stringify({
				type: 'loadChatRooms',
				roomID : room.roomID,
				userID : state.userId,
				newUser: friendUserId
			}))
			const selectRoom = async (roomId) => {
			try {
				state.currentRoom = roomId;
				const chatDiv = document.getElementById('chat');
				if (!chatDiv) return;
				
				chatDiv.innerHTML = '<p class="text-gray-500">Chargement des messages...</p>';
				
				// Get history
				if (state.socket && state.socket.readyState === WebSocket.OPEN) {
					state.socket.send(JSON.stringify({
						type: 'chatHistory',
						roomID: roomId,
						limit: 50
					}));
				}
				// Update visually the selected room
				document.querySelectorAll('#room-list li').forEach(li => {
						const roomNameSpan = li.querySelector('span.flex-1');
						if (roomNameSpan) {
								const dot = roomNameSpan.querySelector('.unread-dot');
								if (dot) dot.remove(); // Enlève tous les dots à chaque sélection
						}
						if (Number(li.dataset.id) === roomId) {
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
	// Friends's profiles
	document.querySelectorAll('.profile-friend-btn').forEach(btn => {
	btn.onclick = () => {
		const friendUsername = btn.dataset.username;
		history.pushState(null, '', `/profile/${encodeURIComponent(friendUsername)}`);
		router();
	};
	});

	// Remove friend
	document.querySelectorAll('.remove-friend-btn').forEach(btn => {
		btn.onclick = async () => {
			const friendUsername = btn.dataset.username;
			const friendUserId = await apiFetch(`/users/by-username/${encodeURIComponent(friendUsername)}`, {
				headers: { 'Authorization': `Bearer ${state.authToken}` }
			}).then(data => data.userId);

			// Show confirmation notification before removing the friend
			showNotification({
				message: `Remove ${friendUsername} from your friends?`,
				type: 'confirm',
				onConfirm: async () => {
					try {
						await apiFetch(`/api/friends/${friendUserId}`, {
							method: 'DELETE',
							headers: { 'Authorization': `Bearer ${state.authToken}` }
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
	// Friends status requests
	const friendsStatusList = friends.map(friend => ({
		friendID: friend.our_index
	}));
	console.log('[FRONT] Envoi friendStatus :', friendsStatusList);
	if (state.socket && state.socket.readyState === WebSocket.OPEN && state.friendsStatusList?.length) {
		state.socket.send(JSON.stringify({
			type: 'friendStatus',
			action: 'request',
			friendList: state.friendsStatusList
		}));
	}
	// Keep for later
	state.friendsStatusList = friendsStatusList;

}

// ─── AUTH HELPERS ──────────────────────────────────────────────────────────────


// Add an event listener for localStorage changes
window.addEventListener('storage', (event) => {
	if (event.key === 'token') {
		// Token was changed in another tab
		state.authToken = event.newValue;
		if (!state.authToken) {
			// Token was removed, force logout
			handleLogout();
		}
	}
});

// Centralized logout handling
export function handleLogout() {
	localStorage.removeItem('token');
	localStorage.removeItem('username');
	localStorage.removeItem('currentRoom');

	updateNav();

	// Close WebSocket if it's open
	if (state.socket && state.socket.readyState === WebSocket.OPEN) {
		state.socket.close();
	}

	state.socket.send(JSON.stringify({
		type: 'friendStatus',
		action: 'update',
		state: 'offline',
		userID: state.userID,
	}));

	state.authToken = null;
	state.userId = null;
	state.currentRoom = 0;
	
	render(HomeView());
}

function setupProfileHandlers() {
  // Back to previous page (or home)
  const backBtn = document.getElementById('backBtnProfile');
  if (backBtn) backBtn.onclick = () => history.back();
}


// =======================
// ROUTER
// =======================

export async function router() {
	const path = window.location.pathname;
	updateNav();

	if (path.startsWith('/profile/')) {
		const username = decodeURIComponent(path.split('/')[2] || '');
		if (!username) {
			history.pushState(null, '', '/');
			return router();
		}
		try {
			const profileUser = await apiFetch(
				`/api/users/username/${encodeURIComponent(username)}`,
				{ headers: { 'Authorization': `Bearer ${state.authToken}` } }
			);
			render(ProfileView(profileUser));
			setupProfileHandlers();
		} catch (e) {
			showNotification({
				message: 'Error during profile loading : ' + e,
				type: 'error',
				duration: 5000,
			});
			history.pushState(null, '', '/');
			router();
		}
		return;
	}

	switch (path) {
		case '/login':
			if (isAuthenticated()) {
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
					const user = await apiFetch('/api/users/me', { headers: { 'Authorization': `Bearer ${state.authToken}` } });
					const friends = await apiFetch('/api/friends', { headers: { 'Authorization': `Bearer ${state.authToken}` } });
					render(AccountView(user, friends));
					initWebSocket();
					setupAccountHandlers(user, friends);
				} catch (e) {
					showNotification({ message: 'Error during account loading :' + e, type: 'error', duration: 5000 });
					history.pushState(null, '', '/');
					router();
				}
			}
			break;
		default:
			render(HomeView());
			if (isAuthenticated()) {
				setupHomeHandlers();
				state.currentRoom = 0;
				initWebSocket();
			}
			break;
	}
}
