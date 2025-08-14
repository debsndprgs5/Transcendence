import { handleLogout } from './handlers';
import { showNotification } from './notifications';
import * as Interfaces from './shared/gameTypes';
import { TypedSocket } from './shared/gameTypes';
//import { WebSocket } from 'ws';

export interface AppState {
	authToken: string | null;
	pendingToken: string | null;
	socket: WebSocket | null;
	gameSocket:WebSocket|null;
	typedSocket:TypedSocket;
	userId?: number;
	currentRoom: number;
	availableRooms: { roomID: number; roomName: string }[];
	availableTournaments?: { tournamentID: number; name: string }[];
	currentTournamentName?: string;
	currentTournamentPlayers?: { username: string; score: number }[];
	isTournamentCreator?: boolean;
	canvasViewState: string;
	currentGameName?: string;
	currentPlayers?: string[];
	friendsStatusList: { friendID: number }[];
	loadRooms?: () => void;
	selectRoom?: (roomId: number) => Promise<void>;
	playerInterface?:Interfaces.playerInterface,
	paddleInterface?:Interfaces.paddleInterface,
	gameInterface?:Interfaces.gameRoomInterface;
	localGameConfig?: {
		ballSpeed: number;
		paddleSpeed: number;
		winningScore: number;
	};
}

export const state: AppState = {
	authToken: null,
	pendingToken: null,
	socket: null,
	gameSocket:null,
	typedSocket:null,
	currentRoom: 0,
	availableRooms: [],
	availableTournaments: [],
	currentTournamentName: undefined,
	currentTournamentPlayers: undefined,
	isTournamentCreator: false,
	canvasViewState: 'mainMenu',
	currentGameName: undefined,
	currentPlayers: undefined,
	friendsStatusList: [],
	playerInterface: undefined,
	paddleInterface: undefined,
	gameInterface: undefined,
	localGameConfig: undefined,
};

export function resetState(){
	Object.assign(state, {
		authToken: null,
		pendingToken: null,
		socket: null,
		gameSocket:null,
		typedSocket:null,
		currentRoom: 0,
		availableRooms: [],
		availableTournaments: [],
		currentTournamentName: undefined,
		currentTournamentPlayers: undefined,
		isTournamentCreator: false,
		canvasViewState: 'mainMenu',
		currentGameName: undefined,
		currentPlayers: undefined,
		friendsStatusList: [],
		playerInterface: undefined,
		paddleInterface: undefined,
		gameInterface: undefined,
		localGameConfig: undefined,
	});
}

// ─── AUTHENTICATION ──────────────────────────────────────────────────────

/**
 * Checks if there's a valid auth token in localStorage.
 */

export function isAuthenticated(): boolean {
	state.authToken = localStorage.getItem('token');
	if (state.playerInterface)
		state.playerInterface!.typedSocket.send('healthcheck', { token: state.authToken });
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

		return new Promise<void>((resolve, reject) => {
			state.socket!.onopen = () => {
				console.log('[CHAT] WebSocket connected');
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
				resolve(); // Resolve when ready to use
			};

			state.socket!.onmessage = async (event: MessageEvent) => {
				console.log('Raw msg from websocket : ', event.data);
				try {
					const parsed = JSON.parse(event.data);
					console.log('Parsed WS message:', parsed);
					await handleWebSocketMessage(parsed);
				} catch (e) {
					console.error('WebSocket message parsing error:', e);
				}
			};

			state.socket!.onclose = (event: CloseEvent) => {
				console.log('WebSocket disconnected:', event.code, event.reason);
			};

			state.socket!.onerror = (error: Event) => {
				console.error('WebSocket Error:', error);
				reject(error); // Reject if connection fails
			};
		});
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
export async function handleWebSocketMessage(msg: WebSocketMsg): Promise<void> {
	const MESSAGE_LIMIT = 15;
	
	switch (msg.type) {
		case 'system': {
			console.log(`{MSG : ${{msg}}}`);
			const chatDiv = document.getElementById('chat');
			if (chatDiv) {
				const systemMsg = document.createElement('p');
				systemMsg.className = 'italic text-gray-500';
				systemMsg.textContent = msg.content;
				chatDiv.appendChild(systemMsg);
				// if(msg.roomID === state.currentRoom){
				// 	appendMessageToChat(chatDiv, {
				// 		isOwnMessage: false,
				// 		name: 'System:',
				// 		content: msg.content,
				// });
				//}
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

		case 'roomDeleted': {
			const wasInDeletedRoom = state.currentRoom === msg.roomID;
			// console.log(`[CHAT] currentRoom: ${state.currentRoom}, msg.roomID: ${msg.roomID}`);
			if (state.loadRooms) {
				await state.loadRooms();
			}
			if (wasInDeletedRoom && state.selectRoom) {
			// if (state.selectRoom) {
				console.log(`[CHAT] Room ${msg.roomID} deleted, switching to general chat.`);
				await state.selectRoom(0);
				showNotification({ message: 'The room you were in was deleted. Moved to general chat.', type: 'info' });
			} else {
				console.log(`[CHAT] Room ${msg.roomID} deleted, but not in it.`);
			}
			break;
		}

		case 'chatHistory': {
			const chatDiv = document.getElementById('chat');
			// console.log(`[CHAT] msg.roomID: ${msg.roomID}, state.currentRoom: ${state.currentRoom}`);
			if (chatDiv && msg.roomID === state.currentRoom && Array.isArray(msg.messages)) {
				// console.log(`[CHAT] Loading chat history for room ${msg.roomID}`);
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
			console.log('[FRIEND] WebSocket friendStatus received:', msg);
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

					if (status === 'online' || status === 'init') {
						dot.style.background = '#22c55e';
					} else if (status === 'in-game' || status === 'playing') {
						dot.style.background = '#facc15';
					} else {
						dot.style.background = '#9ca3af';
					}

					const text = document.createElement('span');
					text.textContent = status;
					text.style.fontWeight = 'bold';
					text.style.textTransform = 'capitalize';

					statusSpan.appendChild(dot);
					statusSpan.appendChild(text);
				});
			}
				if(msg.action === 'updateStatus'){
					if(msg.targetID !== state.playerInterface!.userID){
						console.warn(`[FRIEND UPDATE] userID mismatch target->${msg.targetID} user->${state.playerInterface!.userID}`);
						//SHOULD NOT HAPPEND UNLESS GLITCH
					}
					else{
						const statusSpan = document.querySelector<HTMLElement>(
						`.friend-status[data-userid="${msg.friendID}"]`
					);
					if (!statusSpan) {
						console.warn(
							'[FRONT] Could not find .friend-status for friendID:',
							msg.friendID
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

					if (msg.status === 'online') {
						dot.style.background = '#22c55e';
					} else if (msg.status === 'in-game') {
						dot.style.background = '#facc15';
					} else {
						dot.style.background = '#9ca3af';
					}

					const text = document.createElement('span');
					text.textContent = msg.status;
					text.style.fontWeight = 'bold';
					text.style.textTransform = 'capitalize';

					statusSpan.appendChild(dot);
					statusSpan.appendChild(text);
					}

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
	// Create a container that handles alignment
	const messageContainer = document.createElement('div');
	// use flex to align bubbles left or right
	messageContainer.className = `flex mb-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`;

	// Create the bubble element
	const bubbleDiv = document.createElement('div');
	// styling the chat bubble with tailwind classes
	bubbleDiv.className = [
	  'max-w-xs',            // limit width
	  'px-4', 'py-2',        // padding
	  'rounded-2xl',         // rounded corners
	  'shadow-sm',           // subtle shadow
	  'break-words',         // wrap long text
	  // 'bg-cover',            // ensure background covers
	  'bg-center',           // center background
	  isOwnMessage
	    ? 'bg-msg1bgimage text-amber-200 font-bold'  // own bubble uses msg1 image
	    : 'bg-msg2bgimage text-green-300 font-bold'  // other bubble uses msg2 image
	].join(' ');

	// Determine display name
	let safeUsername = username;
	if (!safeUsername || safeUsername === 'undefined') {
		safeUsername = isOwnMessage
			? localStorage.getItem('username') || 'Me'
			: name;
	}

	// Prefix span (author)
	const prefixSpan = document.createElement('span');
	prefixSpan.className = isOwnMessage
	  ? 'font-semibold'
	  // add username-link so the click handler can detect it
	  : 'font-semibold cursor-pointer hover:underline username-link';
	prefixSpan.textContent = !isOwnMessage ? `${name}: ` : '';
	if (!isOwnMessage) {
	  // store username for click handling
	  prefixSpan.setAttribute('data-username', safeUsername);
	  // optional: improve a11y
	  // prefixSpan.setAttribute('role', 'button');
	  // prefixSpan.tabIndex = 0;
	}

	// Content span (message text)
	const contentSpan = document.createElement('span');
	contentSpan.textContent = content;

	// Assemble elements
	bubbleDiv.appendChild(prefixSpan);
	bubbleDiv.appendChild(contentSpan);
	messageContainer.appendChild(bubbleDiv);
	chatDiv.appendChild(messageContainer);
}