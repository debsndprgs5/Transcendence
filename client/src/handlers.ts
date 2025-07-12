import {
	HomeView,
	LoginView,
	RegisterView,
	AccountView,
	Setup2FAView,
	Verify2FAView,
	ProfileView,
	render
} from './views';
import { isAuthenticated, apiFetch, initWebSocket, state, resetState } from './api';
import { showNotification, showUserActionsBubble } from './notifications';
import { showPongMenu } from './pong_rooms';
import { initGameSocket } from './pong_socket';
//import { WebSocket } from 'ws';

interface User {
	username: string;
	avatarUrl?: string;
	our_index: number;
}




// =======================
// TOKEN VALIDATION
// =======================

/**
 * Periodically validates the stored token by calling /api/auth/me.
 */
export function startTokenValidation(): void {
	setInterval(async () => {
		if (isAuthenticated()) {
			try {
				await apiFetch('/api/auth/me');
			} catch (error) {
				handleLogout();
			}
		}
	}, 30_000); // Check every 30s
}

// =======================
// NAV UPDATE
// =======================

/**
 * Renders the top‐right navigation links depending on auth state.
 */
export function updateNav(): void {
  const authNav = document.getElementById('auth-nav');
  if (!authNav) return;

  const galaxyBtn = (label: string, extraClass: string, hrefOrId: string, isLink = true) => `
    ${isLink
      ? `<a href="${hrefOrId}" data-link class="nav-btn ${extraClass}">`
      : `<button id="${hrefOrId}" class="nav-btn ${extraClass}">`
    }
      <strong>${label.toUpperCase()}</strong>

      <div class="nav-stars">
        <div class="stars"></div>
      </div>
      <div class="nav-halo">
        <div class="nav-circle"></div>
        <div class="nav-circle"></div>
      </div>
    ${isLink ? '</a>' : '</button>'}
  `;

  if (!isAuthenticated()) {
    authNav.innerHTML = `
      ${galaxyBtn('Register', 'register-btn', '/register')}
      ${galaxyBtn('Login',    'login-btn',    '/login')}
    `;
  } else {
    authNav.innerHTML = `
      ${galaxyBtn('Account', 'account-btn', '/account')}
      ${galaxyBtn('Logout',  'logout-btn',  'logoutNavBtn', false)}
    `;

    document.getElementById('logoutNavBtn')!
      .addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        history.pushState(null, '', '/');
        router();
      });
  }
}

// =======================
// EXPORTABLE HELPERS
// =======================

/**
 * Adds a user to a chat room and notifies via WebSocket.
 */
export async function addMemberToRoom(roomId: number, userIdToAdd: number): Promise<void> {
	try {
		await apiFetch(`/api/chat/rooms/${roomId}/members`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${state.authToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ userId: userIdToAdd })
		});

		const response = await fetch('/api/auth/me', {
			headers: { Authorization: `Bearer ${state.authToken}` }
		});
		if (!response.ok) throw new Error('Failed to get userId');
		const data = await response.json();
		state.userId = data.userId;

		state.socket!.send(
			JSON.stringify({
				type: 'loadChatRooms',
				roomID: roomId,
				userID: state.userId,
				newUser: userIdToAdd
			})
		);
	} catch (error) {
		console.error('Error adding member :', error);
	}
}

export interface UserActionParams {
	url: string;
	method?: string;
	successMsg: string;
	errorMsg: string;
}

/**
 * Generic helper for friend/block/unblock actions.
 */
export async function actionOnUser({
	url,
	method = 'POST',
	successMsg,
	errorMsg
}: UserActionParams): Promise<void> {
	const input = document.getElementById('userActionInput') as HTMLInputElement;
	const username = input.value.trim();
	if (!username) {
		return showNotification({ message: 'Please type a Username', type: 'error' });
	}
	try {
		const userId = await getUserIdByUsername(username);
		const result = await apiFetch(url.replace(':userId', String(userId)), {
			method,
			headers: { Authorization: `Bearer ${state.authToken}` }
		});
		if (result.success) {
			showNotification({ message: successMsg, type: 'success' });
		} else {
			showNotification({ message: errorMsg, type: 'error', duration: 5000 });
		}
	} catch (e: any) {
		showNotification({
			message: `${errorMsg} (${e.message})`,
			type: 'error',
			duration: 5000
		});
	}
}

/**
 * Fetches a userId by username (throws if not found).
 */
export async function getUserIdByUsername(username: string): Promise<number> {
	if (!username) throw new Error('Username empty');
	try {
		const response = await fetch(
			`/api/users/by-username/${encodeURIComponent(username)}`,
			{ headers: { Authorization: `Bearer ${state.authToken}` } }
		);
		if (!response.ok) {
			if (response.status === 404) throw new Error('User not found');
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		const data = await response.json();
		if (!data.userId) throw new Error('User not found');
		return data.userId;
	} catch (error) {
		console.error('Error getting user ID:', error);
		throw error;
	}
}

/**
 * Initiates 2FA reconfiguration flow.
 */
export async function reconfigure2FA(): Promise<void> {
	try {
		const response = await fetch('/api/auth/2fa/reconfig', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${state.authToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({})
		});
		const data = await response.json();
		if (response.ok) {
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

/**
 * Creates a direct‐message chat room with another user.
 */
export async function createDirectMessageWith(friendUsername: string): Promise<void> {
	const usernames = [localStorage.getItem('username'), friendUsername].sort();
	const roomName = `${usernames[0]} | ${usernames[1]}`;
	try {
		const room = await apiFetch<{ roomID: number }>('/api/chat/rooms/dm', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${state.authToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ name: roomName })
		});

		const friendUserId = await apiFetch<{ userId: number }>(
			`/users/by-username/${encodeURIComponent(friendUsername)}`,
			{ headers: { Authorization: `Bearer ${state.authToken}` } }
		).then(data => data.userId);

		// Add friend to roomd to resolve module specifier "ws". Relative references must start with either "/", "./", or "../".
		await apiFetch(`/api/chat/rooms/${room.roomID}/members`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${state.authToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ userId: friendUserId })
		});

		const selfUser = await apiFetch<{ userId: number }>('/api/auth/me', {
			headers: { Authorization: `Bearer ${state.authToken}` }
		});
		await apiFetch(`/api/chat/rooms/${room.roomID}/members`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${state.authToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ userId: selfUser.userId })
		});

		state.socket!.send(
			JSON.stringify({
				type: 'loadChatRooms',
				roomID: room.roomID,
				userID: selfUser.userId,
				newUser: friendUserId
			})
		);

		history.pushState(null, '', '/');
		router();
		showNotification({
			message: `Room "${roomName}" created with ${friendUsername}`,
			type: 'success'
		});
	} catch (e: any) {
		showNotification({
			message: `Error while creating the room: ${e.message}`,
			type: 'error',
			duration: 5000
		});
	}
}

// Little helper to resize canvas
export function resizePongCanvas(): void {
	const container = document.querySelector('#pong-canvas')?.parentElement;
	const canvas = document.getElementById('pong-canvas') as HTMLCanvasElement | null;
	if (!canvas || !container) return;
	const rect = container.getBoundingClientRect();
	canvas.width = rect.width;
	canvas.height = rect.height;
}

// =======================
// HANDLERS
// =======================

export let loadRooms: () => Promise<void>;
export let selectRoom: (roomId: number) => Promise<void>;

export async function setupHomeHandlers(): Promise<void> {
	// Resize pong-canvas listener
	setTimeout(() => {
		resizePongCanvas();
		showPongMenu();
	}, 100);

	window.addEventListener('resize', () => {
		resizePongCanvas();
		showPongMenu();
	});

	// Get back the pong view state
	const savedView = localStorage.getItem('pong_view');
	if (savedView === 'waitingGame') {
		state.canvasViewState = 'waitingGame';
		state.currentGameName = localStorage.getItem('pong_room') || undefined;
		try {
			state.currentPlayers = JSON.parse(localStorage.getItem('pong_players') || '[]');
		} catch {
			state.currentPlayers = [];
		}
	}

	const savedTView = localStorage.getItem('tournament_view');
	if (savedTView === 'waitingTournament') {
		const name = localStorage.getItem('tournament_name');
		const idStr= localStorage.getItem('tournament_id');
		const playersJson = localStorage.getItem('tournament_players');
		if (name && idStr && playersJson) {
			state.currentTournamentName    = name;
			state.currentTournamentID      = Number(idStr);
			state.currentTournamentPlayers = JSON.parse(playersJson);
			state.canvasViewState          = 'waitingTournament';
		}
	}
	// Logout button
	const logoutBtn = document.getElementById('logoutNavBtn');
	if (logoutBtn) {
		logoutBtn.addEventListener('click', () => {
			localStorage.removeItem('token');
			localStorage.removeItem('username');
			history.pushState(null, '', '/');
			handleLogout();
			router();
			
		});
	}

	// Clickable usernames listener
	const chatDiv = document.getElementById('chat');
	if (chatDiv && !chatDiv.classList.contains('bubble-listener-added')) {
		chatDiv.classList.add('bubble-listener-added');
		chatDiv.addEventListener('click', (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (target.classList.contains('username-link')) {
				const username = target.getAttribute('data-username')!;
				if (!username) return;
				showUserActionsBubble(target, username);
			}
		});
	}


	// Load rooms immediately when entering home view
	loadRooms = async (): Promise<void> => {
		try {
			const rooms = await apiFetch<{ roomID: number; name?: string; ownerID: number }[]>('/api/chat/rooms/mine', {
				headers: { Authorization: `Bearer ${state.authToken}` }
			});
			const ul = document.getElementById('room-list');
			if (!ul) return;

			ul.innerHTML = rooms
				.map(
					(r) =>
						`<li data-id="${r.roomID}" class="group flex justify-between items-center cursor-pointer hover:bg-gray-100 p-2 rounded ${
							state.currentRoom === r.roomID ? 'bg-indigo-100' : ''
						}">
						<span class="flex-1 truncate" title="${r.name || `Room #${r.roomID}`}">
							${r.name || `Room #${r.roomID}`}
						</span>
						<div class="flex gap-1 opacity-0 group-hover:opacity-100 transition">
							<button data-room="${r.roomID}" class="invite-room-btn text-green-600 hover:text-green-800 text-sm">➕</button>
							${
								r.ownerID === state.userId
									? `<button data-room="${r.roomID}" class="delete-room-btn text-red-600 hover:text-red-800 text-sm">❌</button>`
									: ''
							}
						</div>
					</li>`
				)
				.join('');

			// Get previously selected room
			const savedRoom = Number(localStorage.getItem('currentRoom') || '0');
			const validRoom = rooms.find((r) => r.roomID === savedRoom);

			if (validRoom) {
				state.currentRoom = savedRoom;
			} else if (rooms.length > 0) {
				state.currentRoom = 0;
				localStorage.setItem('currentRoom', String(state.currentRoom));
			} else {
				state.currentRoom = 0;
			}

			// Event listeners for room selection
			document.querySelectorAll<HTMLLIElement>('#room-list li').forEach((li) => {
				li.addEventListener('click', () => selectRoom(Number(li.dataset.id)));
			});

			// Delete Room Button
			document.querySelectorAll<HTMLButtonElement>('.delete-room-btn').forEach((btn) => {
				btn.addEventListener('click', (e) => {
					e.stopPropagation();
					const roomId = Number(btn.dataset.room);
					showNotification({
						message: 'Delete this room?',
						type: 'confirm',
						onConfirm: async () => {
							try {
								const roomMembers = await apiFetch<{ userID: number }[]>(`/api/chat/rooms/${roomId}/members`);
                                await apiFetch(`/api/chat/rooms/${roomId}`, {
                                    method: 'DELETE',
                                    headers: { Authorization: `Bearer ${state.authToken}` }
                                });
                                for (const member of roomMembers) {
                                    state.socket!.send(
                                        JSON.stringify({
                                            type: 'roomDeleted',
                                            roomID: roomId,
                                            targetUserID: member.userID
                                        })
                                    );
                                }
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
			document.querySelectorAll<HTMLButtonElement>('.invite-room-btn').forEach((btn) => {
				btn.addEventListener('click', (e) => {
					e.stopPropagation();
					const roomId = Number(btn.dataset.room);
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
										Authorization: `Bearer ${state.authToken}`,
										'Content-Type': 'application/json'
									},
									body: JSON.stringify({ userId: userIdToInvite })
								});
								const response = await fetch('/api/auth/me', {
									headers: { Authorization: `Bearer ${state.authToken}` }
								});
								if (!response.ok) throw new Error('Failed to get userId');
								const data = await response.json();
								state.userId = data.userId;
								state.socket!.send(
									JSON.stringify({
										type: 'loadChatRooms',
										roomID: roomId,
										userID: state.userId,
										newUser: userIdToInvite
									})
								);
								showNotification({ message: `User ${username} added successfully`, type: 'success' });
							} catch (err: any) {
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
			if (ul) ul.innerHTML = '<li class="text-red-500">Room loading error</li>';
		}
	};

	state.loadRooms = loadRooms;

	// Call loadRooms immediately and set up WebSocket
	if (state.authToken) {
		loadRooms();
		// if (!state.socket || state.socket.readyState === WebSocket.CLOSED)
		// 	initWebSocket();
		// if (!state.playerInterface?.socket || state.playerInterface.socket.readyState === WebSocket.CLOSED)
		// 	await initGameSocket();
	}

	// General chat button
	const generalChatBtn = document.getElementById('generalChatBtn');
	if (generalChatBtn) {
		generalChatBtn.addEventListener('click', () => {
			selectRoom(0);
			document.querySelectorAll<HTMLElement>('#room-list li').forEach((li) => {
				li.classList.remove('bg-indigo-100');
				if (li.dataset.id === '0') li.classList.add('bg-indigo-100');
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
					onConfirm: async (roomName = 'New room') => {
						const newRoom = await apiFetch<{ roomID: number }>('/api/chat/rooms', {
							method: 'POST',
							headers: {
								Authorization: `Bearer ${state.authToken}`,
								'Content-Type': 'application/json'
							},
							body: JSON.stringify({ name: roomName })
						});
						await addMemberToRoom(newRoom.roomID, state.userId!);
						selectRoom(newRoom.roomID);
						await loadRooms();
					}
				});
			} catch (error: any) {
				console.error('Error creating chat room:', error);
				showNotification({ message: 'Error creating chat room: ' + error.message, type: 'error', duration: 5000 });
			}
		});
	}

	// Chat: select room function (internal helper)
	selectRoom= async function(roomId: number): Promise<void> {
		try {
			state.currentRoom = roomId;
			localStorage.setItem('currentRoom', String(roomId));
			const chatDiv = document.getElementById('chat');
			if (!chatDiv) return;

			chatDiv.innerHTML = '<p class="text-gray-500">Loading messages...</p>';

			if (state.socket && state.socket.readyState === WebSocket.OPEN) {
				state.socket.send(
					JSON.stringify({ type: 'chatHistory', roomID: roomId, userID:state.userId , limit: 50 })
				);
			}
			document.querySelectorAll<HTMLElement>('#room-list li').forEach((li) => {
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
		} catch (err) {
			console.error('Error selecting room:', err);
			const chatDiv = document.getElementById('chat');
			if (chatDiv) {
				chatDiv.innerHTML = '<p class="text-red-500">Error loading messages</p>';
			}
		}
	}
    state.selectRoom = selectRoom;

	// Chat: form submission via WebSocket
	const chatForm = document.getElementById('chatForm') as HTMLFormElement | null;
	if (chatForm) {
		chatForm.addEventListener('submit', async (e) => {
			e.preventDefault();
			const formData = new FormData(chatForm);
			const content = formData.get('message');
			if (!content || !state.socket || state.socket.readyState !== WebSocket.OPEN) return;
			if (!state.userId)
			{
				try {
					const resp = await fetch('/api/auth/me', {
					headers: { Authorization: `Bearer ${state.authToken}` }
					});
					if (!resp.ok) throw new Error('Failed to get userId');
					const data = await resp.json();
					state.userId = data.userId;
					if (!state.userId) {
						console.log('userid impossible to get...');
						return;
					}
				} catch (err) {
					console.log('fetch userId error:', err);
					return;
				}
			}
			state.socket.send(
				JSON.stringify({
					type: 'chatRoomMessage',
					chatRoomID: state.currentRoom,
					userID: state.userId,
					content: content
				})
			);
			chatForm.reset();
		});
	}

	// Add friend / block / unblock buttons (searchbar actions)
	const addFriendBtn = document.getElementById('addFriendBtn');
	const blockUserBtn = document.getElementById('blockUserBtn');
	const unblockUserBtn = document.getElementById('unblockUserBtn');

	if (addFriendBtn) {
		addFriendBtn.onclick = () =>
			actionOnUser({ url: '/api/friends/:userId', method: 'POST', successMsg: 'Friend added !', errorMsg: 'Error during add' });
	}
	if (blockUserBtn) {
		blockUserBtn.onclick = async() => {
			await actionOnUser({ url: '/api/blocks/:userId', method: 'POST', successMsg: 'User blocked !', errorMsg: 'Error during block' });
			state.socket!.send(JSON.stringify({ type: 'chatHistory', roomID: state.currentRoom, userID: state.userId, limit: 50 }));
		};
	}
	if (unblockUserBtn) {
		unblockUserBtn.onclick = async() => {
			await actionOnUser({ url: '/api/blocks/:userId', method: 'DELETE', successMsg: 'User unblocked !', errorMsg: 'Error during unblock' });
			state.socket!.send(JSON.stringify({ type: 'chatHistory', roomID: state.currentRoom, userID: state.userId, limit: 50 }));
		};
	}
}
export async function rmMemberFromRoom(roomID: number, userID: number) {
	await apiFetch(`/api/chat/rooms/${roomID}/members/${userID}`, {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${state.authToken}` // if needed
		}
	});
	console.log(`[rmFromChat].user[${userID}]chat[${roomID}]`);
	selectRoom(0);
	await loadRooms();
}

// =======================
// REGISTER HANDLERS
// =======================

export function setupRegisterHandlers(): void {
	const form = document.getElementById('registerForm') as HTMLFormElement | null;
	if (!form) return;

	form.onsubmit = async (e: Event) => {
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
				const err = document.getElementById('register-error') as HTMLElement;
				err.textContent = json.error;
				err.classList.remove('hidden');
			}
		} catch {
			const err = document.getElementById('register-error') as HTMLElement;
			err.textContent = 'Register Error';
			err.classList.remove('hidden');
		}
	};
}

// =======================
// LOGIN HANDLERS
// =======================

export function setupLoginHandlers(): void {
	const form = document.getElementById('loginForm') as HTMLFormElement | null;
	if (!form) return;

	form.onsubmit = async (e: Event) => {
		e.preventDefault();
		const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
		localStorage.setItem('username', data.username);

		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
			const json = await res.json() as any;

			if (res.ok) {
				if (json.need2FASetup) {
					console.log('2FA setup needed, token received:', json.token);
					state.pendingToken = json.token;
					await doSetup2FA(state.pendingToken!);
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
				const err = document.getElementById('login-error') as HTMLElement;
				err.textContent = json.error || 'Login Error';
				err.classList.remove('hidden');
			}
		} catch (err) {
			console.error('Login error:', err);
			const errEl = document.getElementById('login-error') as HTMLElement;
			errEl.textContent = 'Network Error';
			errEl.classList.remove('hidden');
		}
	};
}

// =======================
// 2FA SETUP FLOW
// =======================

export async function doSetup2FA(token: string): Promise<void> {
	if (!token) {
		console.error('No token provided for 2FA setup');
		return;
	}

	try {
		console.log('Sending 2FA setup request with token:', token);
		const res = await fetch('/api/auth/2fa/setup', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({})
		});

		if (!res.ok) {
			const errorData = await res.json();
			throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
		}

		const json = await res.json() as any;
		console.log('2FA setup response:', json);

		if (!json.otpauth_url || !json.base32) {
			throw new Error('Invalid server response: missing required 2FA data');
		}

		render(Setup2FAView(json.otpauth_url, json.base32));
		setupSetup2FAHandlers();
	} catch (err: any) {
		console.error('2FA setup error:', err);
		render(
			`<div class="max-w-md mx-auto mt-12 bg-white p-8 rounded shadow">
				<p class="text-red-500">Impossible to config 2fa, Err : ${err.message}</p>
				<button id="back-login" class="mt-4 w-full py-2 px-4 bg-indigo-600 text-black rounded">
					Retour
				</button>
			</div>`
		);
		document.getElementById('back-login')!.addEventListener('click', () => {
			history.pushState(null, '', '/login');
			router();
		});
	}
}

export function setupSetup2FAHandlers(): void {
	const btn = document.getElementById('verify-setup-2fa-btn') as HTMLButtonElement | null;
	if (!btn) return;
	btn.onclick = async () => {
		const code = (document.getElementById('2fa-setup-code') as HTMLInputElement).value;
		try {
			const res = await fetch('/api/auth/2fa/verify', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${state.pendingToken}`
				},
				body: JSON.stringify({ code })
			});
			const json = await res.json() as any;
			if (res.ok) {
				localStorage.setItem('token', json.token);
				state.authToken = json.token;
				window.location.href = '/';
			} else {
				const err = document.getElementById('setup2fa-error') as HTMLElement;
				err.textContent = json.error;
				err.classList.remove('hidden');
			}
		} catch {
			showNotification({ message: 'Error during 2fa verification', type: 'error', duration: 5000 });
		}
	};
}

export function setupVerify2FAHandlers(): void {
  const form = document.getElementById('verifyForm') as HTMLFormElement | null;
  if (!form) return;

  // set up auto-tabbing on the OTP inputs
  const inputs = Array.from(
    form.querySelectorAll('.v2fa-input')
  ) as HTMLInputElement[];

  inputs.forEach((input, idx) => {
    input.addEventListener('input', () => {
      if (input.value.length === input.maxLength) {
        const next = inputs[idx + 1];
        if (next) next.focus();
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && input.value === '') {
        const prev = inputs[idx - 1];
        if (prev) {
          prev.focus();
          prev.value = '';
        }
      }
    });
  });

  form.onsubmit = async (e: Event) => {
    e.preventDefault();
    // gather the code from all inputs
    const code = inputs.map(i => i.value).join('');
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.pendingToken}`
        },
        body: JSON.stringify({ code })
      });
      const json = await res.json() as any;
      if (res.ok) {
        localStorage.setItem('token', json.token);
        state.authToken = json.token;
        window.location.href = '/';
      } else {
        const errEl = document.getElementById('verify-error') as HTMLElement;
        errEl.textContent = json.error;
        errEl.classList.remove('hidden');
      }
    } catch {
      showNotification({ message: 'Error during 2fa verification', type: 'error', duration: 5000 });
    }
  };
}


/**
 * Sets up event handlers on the Account page.
 */
export function setupAccountHandlers(user: any, friends: User[] = []): void {
	// Back to home button
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

	// Avatar change handling
	const avatarImg = document.getElementById('account-avatar') as HTMLImageElement;
	const avatarInput = document.getElementById('avatarInput') as HTMLInputElement;
	avatarImg.onclick = () => avatarInput.click();
	avatarInput.onchange = async (e: Event) => {
		const files = (e.target as HTMLInputElement).files;
		if (!files || files.length === 0) return;
		const file = files[0];
		// Instant preview
		const reader = new FileReader();
		reader.onload = (ev) => { avatarImg.src = ev.target?.result as string; };
		reader.readAsDataURL(file);
		// Send FormData to server for avatar
		const formData = new FormData();
		formData.append('avatar', file);
		const res = await fetch('/api/users/me/avatar', {
			method: 'POST',
			headers: { Authorization: `Bearer ${state.authToken}` },
			body: formData
		});
		if (!res.ok)
			showNotification({ message: 'Error during avatar uploading!', type: 'error', duration: 5000 });
	};

	// Password change handling
	const profileForm = document.getElementById('profileForm') as HTMLFormElement;
	profileForm.onsubmit = async (e: Event) => {
		e.preventDefault();
		const pwd = (document.getElementById('newPassword') as HTMLInputElement).value;
		if (!pwd)
			return showNotification({ message: 'New password needed!', type: 'error', duration: 5000 });
		try {
			const res = await fetch('/api/users/me/password', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${state.authToken}`
				},
				body: JSON.stringify({ newPassword: pwd })
			});
			if (res.ok)
				showNotification({ message: 'Password modified successfully!', type: 'success' });
			else
				showNotification({ message: 'Error during password modification', type: 'error', duration: 5000 });
		} catch {
			showNotification({ message: 'Network Error', type: 'error', duration: 5000 });
		}
	};

	// 2FA setup/reconfiguration
	const setup2faBtn = document.getElementById('setup2faBtn') as HTMLButtonElement;
	setup2faBtn.onclick = async () => {
		try {
			const response = await fetch('/api/auth/me', {
				headers: { Authorization: `Bearer ${state.authToken}` }
			});
			if (!response.ok) throw new Error('Failed to get userId');
			await reconfigure2FA();
		} catch (error: any) {
			showNotification({ message: 'Error during 2FA reconfiguration: ' + error.message, type: 'error', duration: 5000 });
		}
	};

	async function reconfigure2FA(): Promise<void> {
		try {
			const response = await fetch('/api/auth/2fa/reconfig', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${state.authToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({})
			});
			const data = await response.json();
			if (response.ok) {
				state.pendingToken = data.token;
				render(Setup2FAView(data.otpauth_url, data.base32));
				setupSetup2FAHandlers();
			} else {
				if (data.need2FASetup) {
					showNotification({ message: '2FA must be enabled first before reconfiguring', type: 'error', duration: 5000 });
				} else {
					showNotification({ message: data.error || 'Failed to reconfigure 2FA', type: 'error', duration: 5000 });
				}
			}
		} catch {
			showNotification({ message: 'Error during 2FA reconfiguration', type: 'error', duration: 5000 });
		}
	}

	// Friend direct message buttons
	document.querySelectorAll<HTMLButtonElement>('.chat-friend-btn').forEach(btn => {
		btn.onclick = async () => {
			const friendUsername = btn.dataset.username!;
			await createDirectMessageWith(friendUsername);
		};
	});

	// Friend profile buttons
	document.querySelectorAll<HTMLButtonElement>('.profile-friend-btn').forEach(btn => {
		btn.onclick = () => {
			const friendUsername = btn.dataset.username!;
			history.pushState(null, '', `/profile/${encodeURIComponent(friendUsername)}`);
			router();
		};
	});

	// Friend remove buttons
	document.querySelectorAll<HTMLButtonElement>('.remove-friend-btn').forEach(btn => {
		btn.onclick = async () => {
			const friendUsername = btn.dataset.username!;
			const friendUserId = await apiFetch<{ userId: number }>(
				`/users/by-username/${encodeURIComponent(friendUsername)}`
			).then(data => data.userId);
			showNotification({
				message: `Remove ${friendUsername} from your friends?`,
				type: 'confirm',
				onConfirm: async () => {
					try {
						await apiFetch(`/api/friends/${friendUserId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${state.authToken}` } });
						showNotification({ message: `${friendUsername} removed from your friends`, type: 'success' });
						history.pushState(null, '', '/account');
						router();
					} catch (e: any) {
						showNotification({ message: 'Error removing friend: ' + e.message, type: 'error', duration: 5000 });
					}
				},
				onCancel: () => {
					console.log(`Friend removal for ${friendUsername} was cancelled.`);
				}
			});
		};
	});

	// Switch the history table mode to 2 players
	document.querySelectorAll<HTMLButtonElement>('#button-2-p').forEach(btn => {
		btn.onclick = async () => {
			console.log("2p button clicked");
			const twoPlayerTable = document.getElementById('tab-2-p');
			const twoPlayerButton = document.getElementById("button-2-p");
			const fourPlayerTable = document.getElementById('tab-4-p');
			const fourPlayerButton = document.getElementById("button-4-p");

			fourPlayerButton?.classList.remove('hidden');
			fourPlayerTable?.classList.remove('hidden');
    		twoPlayerButton?.classList.add('hidden');
    		twoPlayerTable?.classList.add('hidden');
		}
	});

	// Switch the history table mode to 4 players
	document.querySelectorAll<HTMLButtonElement>('#button-4-p').forEach(btn => {
		btn.onclick = async () => {
			console.log("4p button clicked");
			const fourPlayerTable = document.getElementById('tab-4-p');
			const fourPlayerButton = document.getElementById("button-4-p");
			const twoPlayerTable = document.getElementById('tab-2-p');
			const twoPlayerButton = document.getElementById("button-2-p");

			fourPlayerButton?.classList.add('hidden');
    		fourPlayerTable?.classList.add('hidden');
			twoPlayerButton?.classList.remove('hidden');
    		twoPlayerTable?.classList.remove('hidden');
		}
	});

	// Send friends status request
	const friendsStatusList = friends.map(f => ({ friendID: f.our_index }));
	if (state.socket && state.socket.readyState === WebSocket.OPEN && friendsStatusList.length) {
		state.socket.send(
			JSON.stringify({ type: 'friendStatus', action: 'request', friendList: friendsStatusList })
		);
	}
	state.friendsStatusList = friendsStatusList;
}


// ─── AUTH HELPERS ──────────────────────────────────────────────────────────────

// Sync authToken across tabs
window.addEventListener('storage', (event: StorageEvent) => {
	if (event.key === 'token') {
		state.authToken = event.newValue as string | null;
		if (!state.authToken) {
			handleLogout();
		}
	}
});

/**
 * Clears all auth state, closes socket and renders Home.
 */
export function handleLogout(): void {
	// Notify server about game leave (only if socket is open)
	if (state.playerInterface?.gameID && state.playerInterface?.socket?.readyState === WebSocket.OPEN) {
		state.playerInterface!.typedSocket.send('leaveGame', {
			userID: state.playerInterface!.userID,
			gameID: state.playerInterface!.gameID,
			islegit: false
		});
	}

	// Send offline status via friend socket (if open)
	if (state.socket?.readyState === WebSocket.OPEN) {
		console.warn(`CLOSING CHAT socket`)
		state.socket?.send(JSON.stringify({
			type: 'friendStatus',
			action: 'update',
			state: 'offline',
			userID: state.userId,
		}));
		state.socket?.close();
	}

	// Close game socket
	if (state.playerInterface?.socket?.readyState === WebSocket.OPEN) {
		console.warn(`[GAMESOCKET] Closing for ${state.userId}`);
		state.playerInterface!.socket?.close();
	}

	// Clear runtime 
	resetState();
	localStorage.clear();

	updateNav();
	window.location.href = '/';
}

/**
 * Sets up the back button on profile view.
 */
function setupProfileHandlers(): void {
	const backBtn = document.getElementById('backBtnProfile');
	if (backBtn) backBtn.onclick = () => history.back();
	
	// Switch the history table mode to 2 players
	document.querySelectorAll<HTMLButtonElement>('#button-2-p').forEach(btn => {
		btn.onclick = async () => {
			console.log("2p button clicked");
			const twoPlayerTable = document.getElementById('tab-2-p');
			const twoPlayerButton = document.getElementById("button-2-p");
			const fourPlayerTable = document.getElementById('tab-4-p');
			const fourPlayerButton = document.getElementById("button-4-p");

			fourPlayerButton?.classList.remove('hidden');
			fourPlayerTable?.classList.remove('hidden');
    		twoPlayerButton?.classList.add('hidden');
    		twoPlayerTable?.classList.add('hidden');
		}
	});

	// Switch the history table mode to 4 players
	document.querySelectorAll<HTMLButtonElement>('#button-4-p').forEach(btn => {
		btn.onclick = async () => {
			console.log("4p button clicked");
			const fourPlayerTable = document.getElementById('tab-4-p');
			const fourPlayerButton = document.getElementById("button-4-p");
			const twoPlayerTable = document.getElementById('tab-2-p');
			const twoPlayerButton = document.getElementById("button-2-p");

			fourPlayerButton?.classList.add('hidden');
    		fourPlayerTable?.classList.add('hidden');
			twoPlayerButton?.classList.remove('hidden');
    		twoPlayerTable?.classList.remove('hidden');
		}
	});
}



// =======================
// ROUTER
// =======================

/**
 * Main SPA router: renders views based on current path.
 */
export async function router(): Promise<void> {
	const path = window.location.pathname;
	updateNav();

	// Profile view
	if (path.startsWith('/profile/')) {
		const username = decodeURIComponent(path.split('/')[2] || '');
		if (!username) {
			history.pushState(null, '', '/');
			return router();
		}
		try {
			const profileUser = await apiFetch(
				`/api/users/username/${encodeURIComponent(username)}`,
				{ headers: { Authorization: `Bearer ${state.authToken}` } }
			);
			const history2 = await apiFetch('/users/me/game_history2', { headers: { Authorization: `Bearer ${state.authToken}` } });
			const history4 = await apiFetch('/users/me/game_history4', { headers: { Authorization: `Bearer ${state.authToken}` } });
			render(ProfileView(profileUser, history2, history4)); // =================NEW HERE===========
			setupProfileHandlers();
		} catch (e: any) {
			showNotification({ message: 'Error during profile loading: ' + e.message, type: 'error', duration: 5000 });
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
					const user = await apiFetch('/api/users/me', { headers: { Authorization: `Bearer ${state.authToken}` } });
					const friends = await apiFetch('/api/friends', { headers: { Authorization: `Bearer ${state.authToken}` } });
					const history2 = await apiFetch('/users/me/game_history2', { headers: { Authorization: `Bearer ${state.authToken}` } });
					const history4 = await apiFetch('/users/me/game_history4', { headers: { Authorization: `Bearer ${state.authToken}` } });
					render(AccountView(user, friends, history2, history4)); //-------------------HERE-------------------
					if (!state.socket || state.socket.readyState === WebSocket.CLOSED)
						initWebSocket();
					if (!state.playerInterface?.socket || state.playerInterface?.socket.readyState === WebSocket.CLOSED)
						initGameSocket();
					setupAccountHandlers(user, friends);
				} catch (e: any) {
					showNotification({ message: 'Error during account loading: ' + e.message, type: 'error', duration: 5000 });
					history.pushState(null, '', '/');
					router();
				}
			}
			break;

		default:
			render(HomeView());
			if (isAuthenticated()) {
				if (!state.socket || state.socket.readyState === WebSocket.CLOSED)
					 await initWebSocket();
				if (!state.playerInterface?.socket || state.playerInterface?.socket.readyState === WebSocket.CLOSED)
					await initGameSocket();
				setupHomeHandlers();
				startTokenValidation();
			}
			break;
	}
}
