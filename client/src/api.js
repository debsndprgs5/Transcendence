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

					if (window.location.pathname === '/account' && state.friendsStatusList?.length) {
						state.socket.send(JSON.stringify({
							type: 'friendStatus',
							action: 'request',
							friendList: state.friendsStatusList
						}));
					}
				}
			}, 100);
		};

		state.socket.onmessage = (event) => {
			console.log('Raw msg from websocket : ', event.data);
			try {
				const parsed = JSON.parse(event.data);
				console.log('ZBOOB 2eme du nom : ', parsed);
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
	// Maximum number of chat messages to keep displayed
	const MESSAGE_LIMIT = 15;

	console.log('handleWebSocketMessage:', msg.type, msg);

	switch (msg.type) {
		case 'system': {
			const chatDiv = document.getElementById('chat');
			if (chatDiv) {
				const systemMsg = document.createElement('p');
				systemMsg.className = 'italic text-gray-500';
				systemMsg.textContent = msg.message;
				chatDiv.appendChild(systemMsg);
			}
			break;
		}

		case 'chatRoomMessage': {
			// Chat messages for the currently selected room
			const chatDiv = document.getElementById('chat');
			if (chatDiv && msg.roomID === state.currentRoom) {
				appendMessageToChat(chatDiv, {
					isOwnMessage: msg.from === state.userId,
					name: msg.from === state.userId ? 'Me' : msg.name_from,
					content: msg.content
				});

				// Limit the number of messages shown
				while (chatDiv.children.length > MESSAGE_LIMIT) {
					chatDiv.removeChild(chatDiv.firstChild);
				}
			} else {
				// If the message is for a room you're not currently viewing,
				// mark it as unread in the room list
				const handleUnread = async (msg) => {
					try {
						if (msg.roomID === 0) return;

						// Fetch the list of rooms the user is a member of
						const userRooms = await apiFetch('/api/chat/rooms/mine', {
							headers: { 'Authorization': `Bearer ${state.authToken}` }
						});
						const isMessageForMyRoom = userRooms.some(room => room.roomID === msg.roomID);

						if (isMessageForMyRoom) {
							const roomListItem = document.querySelector(`#room-list li[data-id="${msg.roomID}"]`);
							if (!roomListItem) return;

							const roomNameSpan = roomListItem.querySelector('span.flex-1');
							if (!roomNameSpan) return;

							// Only add the unread dot if it's not already there
							if (!roomNameSpan.querySelector('.unread-dot')) {
								roomNameSpan.insertAdjacentHTML('beforeend', `
									<span class="unread-dot" style="
										display:inline-block;
										width:0.6em;
										height:0.6em;
										background:red;
										border-radius:50%;
										margin-left:0.5em;
										vertical-align:middle;
									" title="New message"></span>
								`);
							}
						}
					} catch (err) {
						console.error('Error while marking room as unread:', err);
					}
				};
				handleUnread(msg);
			}
			break;
		}

		case 'chatHistory': {
			// Display chat history when loading a room
			const chatDiv = document.getElementById('chat');
			if (chatDiv && msg.roomID === state.currentRoom && Array.isArray(msg.messages)) {
				chatDiv.innerHTML = '';
				const recentMessages = msg.messages.slice(-MESSAGE_LIMIT);
				recentMessages.forEach(historyMsg => {
					appendMessageToChat(chatDiv, {
						isOwnMessage: historyMsg.from === state.userId,
						name: historyMsg.from === state.userId ? 'Me' : historyMsg.name_from,
						content: historyMsg.content
					});
				});
			}
			break;
		}

		case 'loadChatRooms': {
			// Reload the room list if needed (for example, after being invited)
			if (msg.newUser === state.userId && typeof state.loadRooms === "function") {
				state.loadRooms();
			}
			break;
		}

		case 'friendStatus': {
			// Friend status updates (online/offline)
			console.log('[FRONT] WebSocket friendStatus received:', msg);
			if (msg.action === 'response' && Array.isArray(msg.list)) {
				msg.list.forEach(({ friendID, status }) => {
					// Target the correct status span using data-userid
					const statusSpan = document.querySelector(`.friend-status[data-userid="${friendID}"]`);
					if (statusSpan) {
						// Remove previous content
						statusSpan.innerHTML = '';

						// Create the colored dot
						const dot = document.createElement('span');
						dot.style.display = 'inline-block';
						dot.style.width = '0.75em';
						dot.style.height = '0.75em';
						dot.style.borderRadius = '50%';
						dot.style.marginRight = '0.3em';
						dot.style.verticalAlign = 'middle';

						// Color depending on status
						if (status === 'online') {
							dot.style.background = '#22c55e'; // Tailwind green-500
						} else if (status === 'in-game') {
							dot.style.background = '#facc15'; // Tailwind yellow-400
						} else {
							dot.style.background = '#9ca3af'; // Tailwind gray-400
						}

						// Create the text label
						const text = document.createElement('span');
						text.textContent = (status === 'in-game') ? 'in game' : status;

						// Optional: style the text if you want
						text.style.fontWeight = 'bold';
						text.style.textTransform = 'capitalize';

						// Append both to the statusSpan
						statusSpan.appendChild(dot);
						statusSpan.appendChild(text);
					} else {
						console.warn('[FRONT] Could not find .friend-status for friendID:', friendID);
					}
				});
			}
			break;
		}

		default:
			console.warn('Unrecognized WebSocket message type:', msg.type);
	}
}

// Auxillary function to append a message to chat
export function appendMessageToChat(chatDiv, { isOwnMessage, name, content, username }) {
    const messageP = document.createElement('p');
    messageP.className = isOwnMessage ? 'text-right mb-1' : 'text-left mb-1';

    // Infer username if missing or empty (fallback on name)
    let safeUsername = username;
    if (!safeUsername || safeUsername === 'undefined') {
        // Try from localStorage or fallback to name
        safeUsername = isOwnMessage
            ? localStorage.getItem('username') || 'Me'
            : name;
    }

    // Name prefix: clickable for others, not for yourself
    let prefixSpan;
    if (isOwnMessage) {
        prefixSpan = document.createElement('span');
        prefixSpan.className = 'text-green-600 font-semibold';
        prefixSpan.textContent = 'Me: ';
    } else {
        prefixSpan = document.createElement('span');
        prefixSpan.className = 'text-blue-600 font-semibold username-link cursor-pointer hover:underline';
        prefixSpan.textContent = `${name}: `;
        // Always set a valid username, never undefined
        prefixSpan.setAttribute('data-username', safeUsername);
    }

    const contentSpan = document.createElement('span');
    contentSpan.className = 'text-gray-800';
    contentSpan.textContent = content;

    messageP.appendChild(prefixSpan);
    messageP.appendChild(contentSpan);
    chatDiv.appendChild(messageP);
}