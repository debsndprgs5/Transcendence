import { handleLogout } from './handlers';

export interface AppState {
	authToken: string | null;
	pendingToken: string | null;
	socket: WebSocket | null;
	userId: number | null;
	currentRoom: number;
	canvasViewState: string;
	friendsStatusList: { friendID: number }[];
	loadRooms?: () => void;
	gameSocket:WebSocket | null;
	playerState: string;
}

export const state: AppState = {
	authToken: null,
	pendingToken: null,
	socket: null,
	userId: null,
	currentRoom: 0,
	canvasViewState: 'mainMenu',
	friendsStatusList: [],
	playerState: 'online',
	gameSocket: null,
};

// ─── AUTHENTICATION ──────────────────────────────────────────────────────

/**
 * Checks if there's a valid auth token in localStorage.
 */

export function isAuthenticated(): boolean {
	state.authToken = localStorage.getItem('token');
	return !!state.authToken;
}


// ─── API FETCH ────────────────────────────────────────────────────────────

/**
 * A wrapper around fetch that prefixes `/api` if needed,
 * handles JSON bodies, error statuses, and session expiry.
 */
export async function apiFetch<T = any>(
	url: string,
	options: RequestInit = {}
): Promise<T> {
	try {
		const apiUrl = url.startsWith('/api') ? url : `/api${url}`;

		const headers: Record<string, string> = {
			...(options.headers as Record<string, string> | undefined ?? {}),
		};

		if (options.body) {
			headers['Content-Type'] = 'application/json';
		}

		const response = await fetch(apiUrl, {
			...options,
			headers,
		});

		if (response.status === 401) {
			handleLogout();
			throw new Error('Session expired. Please log in again.');
		}

		//const data = await response.json();
		const rawText = await response.text();
		console.log('Raw API response:', rawText);

		let data;
		try {
			data = JSON.parse(rawText);
		} catch (err) {
			console.error('Failed to parse JSON. Raw response:', rawText);
			throw err;
		}

		if (!response.ok) {
			throw new Error(data.error || 'An error has occurred');
		}

		return data;
	} catch (error) {
		console.error('apiFetch error:', error);
		throw error;
	}
}

// ─── HELPERS ──────────────────────────────────────────────────────────────

/**
 * Reads the `userId` cookie and returns it as a number.
 */
export function getUserIdFromCookie(): number | null {
	try {
		const cookies = document.cookie.split(';');
		for (const cookie of cookies) {
			const [name, value] = cookie.trim().split('=');
			if (name === 'userId') {
				console.log('Found userId cookie:', value);
				const userId = Number(value);
				if (!isNaN(userId)) {
					return userId;
				}
			}
		}
		console.log('No userId cookie found in:', document.cookie);
	} catch (error) {
		console.error('Error parsing userId cookie:', error);
	}
	return null;
}

// ─── WEBSOCKETS ────────────────────────────────────────────────────────────

/**
 * Initializes the WebSocket connection once authenticated.
 */
export async function initWebSocket(): Promise<void> {
	if (!isAuthenticated()) {
		console.warn("WebSocket: no auth token");
		return;
	}
	try {
		const resp = await fetch('/api/auth/me', {
			headers: {
				'Authorization': `Bearer ${state.authToken}`,
			},
		});

		if (!resp.ok) {
			throw new Error('Failed to get userId');
		}

		const result = await resp.json();
		state.userId = result.userId;

		if (!state.userId) {
			console.warn('WebSocket: userId not obtained');
			return;
		}

		const wsUrl = `wss://${location.host}/chat/ws?token=${encodeURIComponent(state.authToken!)}`;

		if (state.socket && state.socket.readyState === WebSocket.OPEN) {
			state.socket.close();
		}

		state.socket = new WebSocket(wsUrl);

		state.socket.onopen = () => {
			setTimeout(() => {
				if (state.socket!.readyState === WebSocket.OPEN) {
					state.socket!.send(
						JSON.stringify({
							type: 'chatHistory',
							roomID: state.currentRoom,
							userID: state.userId,
							limit: 50,
						})
					);

					if (
						window.location.pathname === '/account' &&
						state.friendsStatusList?.length
					) {
						state.socket!.send(
							JSON.stringify({
								type: 'friendStatus',
								action: 'request',
								friendList: state.friendsStatusList,
							})
						);
					}
				}
			}, 100);
		};

		state.socket.onmessage = (event: MessageEvent) => {
			console.log('Raw msg from websocket : ', event.data);
			try {
				const parsed = JSON.parse(event.data);
				console.log('Parsed WS message:', parsed);
				handleWebSocketMessage(parsed);
			} catch (e) {
				console.error('WebSocket message parsing error:', e);
			}
		};

		state.socket.onclose = (event: CloseEvent) => {
			console.log('WebSocket disconnected:', event.code, event.reason);
		};

		state.socket.onerror = (error: Event) => {
			console.error('WebSocket Error:', error);
		};
	} catch (error) {
		console.error('Error during WebSocket init:', error);
	}
}

// ─── MESSAGE HANDLING ──────────────────────────────────────────────────────

export interface WebSocketMsg {
	type: string;
	[key: string]: any;
}

/**
 * Handles incoming WebSocket messages and routes them by type.
 */
export function handleWebSocketMessage(msg: WebSocketMsg): void {
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
			const chatDiv = document.getElementById('chat');
			if (chatDiv && msg.roomID === state.currentRoom) {
				appendMessageToChat(chatDiv, {
					isOwnMessage: msg.from === state.userId,
					name: msg.from === state.userId ? 'Me' : msg.name_from,
					content: msg.content,
				});

				while (chatDiv.children.length > MESSAGE_LIMIT) {
					chatDiv.removeChild(chatDiv.firstChild!);
				}
			} else {
				(async (m: WebSocketMsg) => {
					try {
						if (m.roomID === 0) return;
						const userRooms = await apiFetch<{ roomID: number }[]>(
							'/api/chat/rooms/mine',
							{ headers: { Authorization: `Bearer ${state.authToken}` } }
						);
						const isForMyRoom = userRooms.some((r) => r.roomID === m.roomID);
						if (!isForMyRoom) return;

						const roomListItem = document.querySelector<
							HTMLLIElement
						>(`#room-list li[data-id="${m.roomID}"]`);
						if (!roomListItem) return;

						const roomNameSpan = roomListItem.querySelector<HTMLSpanElement>(
							'span.flex-1'
						);
						if (!roomNameSpan) return;

						if (!roomNameSpan.querySelector('.unread-dot')) {
							roomNameSpan.insertAdjacentHTML(
								'beforeend',
								`
								<span class="unread-dot" style="
									display:inline-block;
									width:0.6em;
									height:0.6em;
									background:red;
									border-radius:50%;
									margin-left:0.5em;
									vertical-align:middle;
								" title="New message"></span>`
							);
						}
					} catch (err) {
						console.error('Error while marking room as unread:', err);
					}
				})(msg);
			}
			break;
		}

		case 'chatHistory': {
			const chatDiv = document.getElementById('chat');
			if (chatDiv && msg.roomID === state.currentRoom && Array.isArray(msg.messages)) {
				chatDiv.innerHTML = '';
				const recent = msg.messages.slice(-MESSAGE_LIMIT);
				recent.forEach((historyMsg: any) => {
					appendMessageToChat(chatDiv, {
						isOwnMessage: historyMsg.from === state.userId,
						name: historyMsg.from === state.userId ? 'Me' : historyMsg.name_from,
						content: historyMsg.content,
					});
				});
			}
			break;
		}

		case 'loadChatRooms': {
			if (
				msg.newUser === state.userId &&
				typeof state.loadRooms === 'function'
			) {
				state.loadRooms();
			}
			break;
		}

		case 'friendStatus': {
			console.log('[FRONT] WebSocket friendStatus received:', msg);
			if (msg.action === 'response' && Array.isArray(msg.list)) {
				msg.list.forEach(({ friendID, status }: any) => {
					const statusSpan = document.querySelector<HTMLElement>(
						`.friend-status[data-userid="${friendID}"]`
					);
					if (!statusSpan) {
						console.warn(
							'[FRONT] Could not find .friend-status for friendID:',
							friendID
						);
						return;
					}

					statusSpan.innerHTML = '';

					const dot = document.createElement('span');
					dot.style.display = 'inline-block';
					dot.style.width = '0.75em';
					dot.style.height = '0.75em';
					dot.style.borderRadius = '50%';
					dot.style.marginRight = '0.3em';
					dot.style.verticalAlign = 'middle';

					if (status === 'online') {
						dot.style.background = '#22c55e';
					} else if (status === 'in-game') {
						dot.style.background = '#facc15';
					} else {
						dot.style.background = '#9ca3af';
					}

					const text = document.createElement('span');
					text.textContent = status === 'in-game' ? 'in game' : status;
					text.style.fontWeight = 'bold';
					text.style.textTransform = 'capitalize';

					statusSpan.appendChild(dot);
					statusSpan.appendChild(text);
				});
			}
			break;
		}

		default:
			console.warn('Unrecognized WebSocket message type:', msg);
	}
}

// ─── APPEND MESSAGE ─────────────────────────────────────────────────────────

export interface ChatMessageOptions {
	isOwnMessage: boolean;
	name: string;
	content: string;
	username?: string;
}

/**
 * Appends a single chat message `<p>` into the given container.
 */
export function appendMessageToChat(
	chatDiv: HTMLElement,
	{ isOwnMessage, name, content, username }: ChatMessageOptions
): void {
	const messageP = document.createElement('p');
	messageP.className = isOwnMessage ? 'text-right mb-1' : 'text-left mb-1';

	let safeUsername = username;
	if (!safeUsername || safeUsername === 'undefined') {
		safeUsername = isOwnMessage
			? localStorage.getItem('username') || 'Me'
			: name;
	}

	let prefixSpan: HTMLSpanElement;
	if (isOwnMessage) {
		prefixSpan = document.createElement('span');
		prefixSpan.className = 'text-green-500 font-semibold';
		prefixSpan.textContent = 'Me: ';
	} else {
		prefixSpan = document.createElement('span');
		prefixSpan.className =
			'text-blue-600 font-semibold username-link cursor-pointer hover:underline';
		prefixSpan.textContent = `${name}: `;
		prefixSpan.setAttribute('data-username', safeUsername);
	}

	const contentSpan = document.createElement('span');
	contentSpan.className = 'text-gray-800';
	contentSpan.textContent = content;

	messageP.appendChild(prefixSpan);
	messageP.appendChild(contentSpan);
	chatDiv.appendChild(messageP);
}
