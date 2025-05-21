export const state = {
	authToken: null,
	pendingToken: null,
	socket: null,
	userId: null,
	currentRoom: 0,
};

export function isAuthenticated() {
	state.authToken = localStorage.getItem('token');
	return !!state.authToken;
}


// ─── API FETCH ─────────────────────────────────────────────────────────
export async function apiFetch(url, options = {}) {
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

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Read cookie's userId
export function getUserIdFromCookie() {
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



// ─── WEBSOCKETS ────────────────────────────────────────────────────────────────


// Initialize WS if both userId and authtoken are setup
export async function initWebSocket() {
	if (!isAuthenticated()) {
		console.warn('WebSocket: pas de token d\'authentification');
		return;
	}

	try {
		// Get userId via API
		const response = await fetch('/api/auth/me', {
			headers: {
				'Authorization': `Bearer ${state.authToken}`
			}
		});

		if (!response.ok) {
			throw new Error('Failed to get userId');
		}

		const data = await response.json();
		state.userId = data.userId;

		if (!state.userId) {
			console.warn('WebSocket: userId non obtenu');
			return;
		}

		const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
		const wsUrl = `${protocol}://${location.host}/ws?token=${encodeURIComponent(state.authToken)}`;

		// Close old socket if already open
		if (state.socket && state.socket.readyState === WebSocket.OPEN) {
			state.socket.close();
		}

		state.socket = new WebSocket(wsUrl);

		state.socket.onopen = () => {
			setTimeout(() => {
				if (state.socket.readyState === WebSocket.OPEN) {
					state.socket.send(JSON.stringify({
						type: 'chatHistory',
						roomID: state.currentRoom,
						limit: 50
					}));
					state.socket.send(JSON.stringify({
						type: 'friendStatus',
						action: 'update',
						state: 'online',
						userID: state.userID,
					}));
				}
			}, 100);
		};

		state.socket.onmessage = (event) => {
			console.log('Raw msg from websocket : ', event.data);
			try {
				const parsed = JSON.parse(event.data);
				handleWebSocketMessage(parsed);
			} catch (e) {
				console.error('Websocket message parsing error:', e);
			}
		};

		state.socket.onclose = (event) => {
			console.log('WebSocket disconnected:', event.code, event.reason);
		};

		state.socket.onerror = (error) => {
			console.error('WebSocket Error:', error);
		};
	} catch (error) {
		console.error('Error during WebSocket init:', error);
	}
}


// Auxilliary function to handle websocket messages
export function handleWebSocketMessage(msg) {
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
			if (msg.roomID === state.currentRoom) {
				appendMessageToChat(chatDiv, {
					isOwnMessage: msg.from === state.userId,
					name: msg.from === state.userId ? 'Moi' : msg.name_from,
					content: msg.content
				});

				// Keep only the last 15
				while (chatDiv.children.length > MESSAGE_LIMIT) {
					chatDiv.removeChild(chatDiv.firstChild);
				}
			}
			else {
				const handleUnread = async(msg) => {
					try {
						if(msg.roomID === 0)
							return;
						
						// Get list of rooms the user is currently a member of
						const userRooms = await apiFetch('/api/chat/rooms/mine', {
							headers: { 'Authorization': `Bearer ${state.authToken}` }
						});

						// Check if the incoming message belongs to one of these rooms
						const isMessageForMyRoom = userRooms.some(room => room.roomID === msg.roomID);

						if (isMessageForMyRoom) {
							// Find the room element in the UI
							const roomListItem = document.querySelector(`#room-list li[data-id="${msg.roomID}"]`);
							if (!roomListItem) return;

							// Find the dot span
							const roomNameSpan = roomListItem.querySelector('span.flex-1');
							if (!roomNameSpan) return;

							// If the dot isn't present yet
							if (!roomNameSpan.querySelector('.unread-dot')) {
									// add dot
									roomNameSpan.insertAdjacentHTML('beforeend', `
											<span class="unread-dot" style="
													display:inline-block;
													width:0.6em;
													height:0.6em;
													background:red;
													border-radius:50%;
													margin-left:0.5em;
													vertical-align:middle;
											" title="Nouveau message"></span>
									`);
							}
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
			if (msg.roomID === state.currentRoom && Array.isArray(msg.messages)) {
				chatDiv.innerHTML = ''; // empty chat
				
				// Get the last 15 messages from history
				const recentMessages = msg.messages
					.slice(-MESSAGE_LIMIT);
				
				// Render messages in chronologic order
				recentMessages.forEach(historyMsg => {
					appendMessageToChat(chatDiv, {
						isOwnMessage: historyMsg.from === state.userId,
						name: historyMsg.from === state.userId ? 'Moi' : historyMsg.name_from,
						content: historyMsg.content
					});
				});
			}
			break;
		case 'loadChatRooms':
			//if(msg.roomID !== state.currentRoom){
			if (msg.newUser === state.userId && typeof state.loadRooms === "function") {
				state.loadRooms();
			}
			//}
			break;
		case 'friendStatus':
			console.log('[FRONT] Message WebSocket friendStatus :', msg);
			if (msg.action === 'response' && Array.isArray(msg.list)) {
				msg.list.forEach(({ friendID, status }) => {
					const btn = document.querySelector(`.chat-friend-btn[data-userid="${friendID}"]`);
					const friendLi = btn?.closest('li');
					if (friendLi) {
						let statusSpan = friendLi.querySelector('.friend-status');
						if (statusSpan) {
							let color = status === 'online' ? 'text-green-500' : 'text-gray-400';
							if (status === 'in-game') color = 'text-yellow-500';
							statusSpan.className = `friend-status ml-2 text-xs align-middle ${color}`;
							statusSpan.textContent = status;
						}
					}
				});
			} else {
				console.warn(`[FRONT] Impossible de trouver le bouton ou le li pour l'ami`, friendID);
			}
			break;
		default:
			console.warn('Type de message WebSocket non géré:', msg.type);
	}
}

// Auxillary function to append a message to chat
export function appendMessageToChat(chatDiv, { isOwnMessage, name, content }) {
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
