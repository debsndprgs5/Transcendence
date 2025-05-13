// ─── AUTH STATE ──────────────────────────────────────────────────────────────
let authToken    = localStorage.getItem('token');
let pendingToken = null;
let socket;           // global WebSocket
let userId;           // read from the cookie
let currentRoom = 0;  // selected room

// ─── RENDER ──────────────────────────────────────────────────────────────────
function render(html) {
	const app = document.getElementById('app');
	if (app) app.innerHTML = html;
}

// ─── VIEWS ────────────────────────────────────────────────────────────────────

function HomeView() {
	if (!authToken) {
		// user not connected
		return `
			<section class="bg-white rounded-lg shadow-lg overflow-hidden md:flex">
				<div class="p-8 md:w-1/2">
					<h1 class="text-4xl font-bold text-indigo-600 mb-4">
						Bienvenue sur Transcendence
					</h1>
					<p class="text-gray-700 mb-6">
						Rejoignez des parties de Pong en temps réel, discutez avec vos amis et défiez notre IA.
					</p>
					<div class="space-x-4">
						<a href="/register" data-link
							 class="inline-block px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition">
							Créer un compte
						</a>
						<a href="/login" data-link
							 class="inline-block px-6 py-3 border border-indigo-600 text-indigo-600 font-medium rounded-lg hover:bg-indigo-50 transition">
							Se connecter
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
				Bienvenue, <span class="font-bold">${userName}</span> !
			</h1>
		</div>

		<div class="grid gap-6 md:grid-cols-2">
			<!-- Game section -->
			<div class="bg-white p-6 rounded-lg shadow-lg flex flex-col">
				<h2 class="text-2xl font-semibold text-indigo-600 mb-4">Parties disponibles</h2>
				<div id="games-list" class="flex-1 overflow-auto space-y-3"></div>
				<button id="newGameBtn"
								class="mt-4 px-4 py-2 bg-green-500 text-black rounded-lg hover:bg-green-600 transition">
					+ Créer une partie
				</button>
			</div>

			<!-- Chat section -->
			<div class="bg-white p-6 rounded-lg shadow-lg flex flex-col">
				<h2 class="text-2xl font-semibold text-indigo-600 mb-4 flex justify-between items-center">
					<span>Chat</span>
					<button id="newChatRoomBtn" class="px-3 py-1 bg-indigo-100 text-indigo-600 rounded hover:bg-indigo-200 transition text-sm">
						+ Salon
					</button>
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
							<input name="message" placeholder="Écrire un message…"
										 class="flex-1 border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-300" />
							<button type="submit"
											class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
								Envoyer
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
					<h2 class="text-3xl font-bold">Connexion</h2>
					<p class="mt-2">Accédez à votre compte</p>
				</div>
				<!------ Form ------>
				<form id="loginForm" class="px-8 py-6 space-y-6 bg-white">
					<div>
						<label for="username" class="block text-sm font-medium text-gray-700">Nom d’utilisateur</label>
						<input id="username" name="username" type="text" required
									 class="mt-1 block w-full px-4 py-2 border-2 border-indigo-300 rounded-lg
													focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"/>
					</div>
					<div>
						<label for="password" class="block text-sm font-medium text-gray-700">Mot de passe</label>
						<input id="password" name="password" type="password" required
									 class="mt-1 block w-full px-4 py-2 border-2 border-indigo-300 rounded-lg
													focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"/>
					</div>
					<button type="submit"
									class="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold 
												 hover:bg-indigo-700 transition">
						Se connecter
					</button>
					<p id="login-error" class="text-red-500 text-sm text-center hidden"></p>
				</form>
				<!------ Transit to register ------>
				<div class="px-8 py-4 bg-gray-100 text-center">
					<p class="text-sm text-gray-600">
						Vous n’avez pas de compte ?
						<a href="/register" data-link class="text-indigo-600 font-medium hover:underline">
							Inscrivez-vous
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
					<h2 class="text-3xl font-bold">Inscription</h2>
					<p class="mt-2">Créez votre compte</p>
				</div>
				<!------ Form ------>
				<form id="registerForm" class="px-8 py-6 space-y-6 bg-white">
					<div>
						<label for="username" class="block text-sm font-medium text-gray-700">Nom d’utilisateur</label>
						<input id="username" name="username" type="text" required
									 class="mt-1 block w-full px-4 py-2 border-2 border-purple-300 rounded-lg
													focus:outline-none focus:ring-2 focus:ring-purple-400 transition"/>
					</div>
					<div>
						<label for="password" class="block text-sm font-medium text-gray-700">Mot de passe</label>
						<input id="password" name="password" type="password" required
									 class="mt-1 block w-full px-4 py-2 border-2 border-purple-300 rounded-lg
													focus:outline-none focus:ring-2 focus:ring-purple-400 transition"/>
					</div>
					<button type="submit"
									class="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold 
												 hover:bg-indigo-700 transition">
						Créer mon compte
					</button>
					<p id="register-error" class="text-red-500 text-sm text-center hidden"></p>
				</form>
				<!------ Transit to login ------>
				<div class="px-8 py-4 bg-gray-100 text-center">
					<p class="text-sm text-gray-600">
						Déjà un compte ?
						<a href="/login" data-link class="text-indigo-600 font-medium hover:underline">
							Connectez-vous
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
				<p class="text-gray-700">Scannez ce QR code avec votre application d'authentification :</p>
				<img src="${chartUrl}" alt="QR Code 2FA" class="mx-auto w-48 h-48" />
				<p class="text-gray-700">Ou entrez ce code manuellement :</p>
				<code class="block bg-gray-100 p-2 rounded font-mono text-sm">${base32}</code>
			</div>
			<div class="px-6 pb-6 space-y-2">
				<input id="2fa-setup-code" placeholder="Entrez le code 2FA"
							 class="w-full border-gray-300 rounded-md shadow-sm p-2 
											focus:ring-yellow-500 focus:border-yellow-500" />
				<button id="verify-setup-2fa-btn"
								class="w-full py-2 px-4 bg-yellow-600 text-black font-semibold 
											 rounded-md hover:bg-yellow-700 transition">
					Vérifier le code
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
				<h2 class="text-2xl font-bold text-yellow-700">Vérifier la 2FA</h2>
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
					Vérifier
				</button>
				<p id="verify-error" class="text-red-500 text-sm mt-2 hidden"></p>
			</form>
		</div>
	`;
}

// ─── ROUTER ──────────────────────────────────────────────────────────────────
function router() {
	const path = window.location.pathname;
	authToken = localStorage.getItem('token');

	// update nav before render -> to render either login/register or disconnect
	updateNav();

	switch (path) {
		case '/login':
			render(LoginView());
			setupLoginHandlers();
			break;
		case '/register':
			render(RegisterView());
			setupRegisterHandlers();
			break;
		default:
			render(HomeView());
			setupHomeHandlers();
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
								return Number(value);
						}
				}
		} catch (error) {
				console.error('Error parsing userId cookie:', error);
		}
		return null;
}

// ─── API FETCH HELPER ─────────────────────────────────────────────────────────
async function apiFetch(url, options = {}) {
		try {
				const response = await fetch(url, {
						...options,
						headers: {
								'Content-Type': 'application/json',
								...options.headers
						}
				});
				
				const data = await response.json();
				
				if (!response.ok) {
						throw new Error(data.error || 'Une erreur est survenue');
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
window.addEventListener('popstate', router);
window.addEventListener('DOMContentLoaded', router);

document.addEventListener('DOMContentLoaded', () => {
	router();
});
window.addEventListener('popstate', router);
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
	if (!authToken) {
		authNav.innerHTML = `
			<a href="/register" data-link
				 class="px-4 py-2 border border-indigo-600 text-indigo-600 rounded hover:bg-indigo-50 transition">
				Inscription
			</a>
			<a href="/login" data-link
				 class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition">
				Connexion
			</a>
		`;
	} else {
		authNav.innerHTML = `
			<button id="logoutNavBtn"
							class="px-4 py-2 bg-red-500 text-black rounded hover:bg-red-600 transition">
				Déconnexion
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
	// Once home is loaded for a logged user, init WS
	initWebSocket();
	// "Create game" button -> a modifier pour integrer le jeu
	const newGameBtn = document.getElementById('newGameBtn');
	if (newGameBtn) {
		newGameBtn.addEventListener('click', () => {
			// call API to create a new game soon inshallah
			console.log('Create new game clicked');
		});
	}

	// Chat: Load rooms
	const loadRooms = async () => {
			try {
					const rooms = await apiFetch('/api/chat/rooms', { 
							headers: { 'Authorization': `Bearer ${authToken}` } 
					});
					const ul = document.getElementById('room-list');
					if (!ul) return;
					
					ul.innerHTML = rooms.map(r => 
							`<li data-id="${r.roomID}" class="cursor-pointer hover:bg-gray-100 p-2 rounded">
									${r.name || `Salon #${r.roomID}`}
							</li>`
					).join('');
					
					document.querySelectorAll('#room-list li').forEach(li => {
							li.addEventListener('click', () => selectRoom(Number(li.dataset.id)));
					});
			} catch (error) {
					console.error('Error loading rooms:', error);
					const ul = document.getElementById('room-list');
					if (ul) {
							ul.innerHTML = '<li class="text-red-500">Erreur de chargement des salons</li>';
					}
			}
	};

	// Chat: New room
	const newChatRoomBtn = document.getElementById('newChatRoomBtn');
	if (newChatRoomBtn) newChatRoomBtn.addEventListener('click', async () => {
		await apiFetch('/api/chat/rooms', { method: 'POST', headers: { 'Authorization': `Bearer ${authToken}` } });
		loadRooms();
	});



	// Chat: Select room
	const selectRoom = async (roomId) => {
			try {
					currentRoom = roomId;
					const chatDiv = document.getElementById('chat');
					if (!chatDiv) return;
					
					chatDiv.innerHTML = '<p class="text-gray-500">Chargement des messages...</p>';
					
					const messages = await apiFetch(
							`/api/chat/rooms/${roomId}/messages?limit=50`,
							{ headers: { 'Authorization': `Bearer ${authToken}` } }
					);
					
					chatDiv.innerHTML = '';
					messages.reverse().forEach(m => {
							const p = document.createElement('p');
							p.textContent = `${m.authorID}: ${m.content}`;
							chatDiv.appendChild(p);
					});
			} catch (error) {
					console.error('Error selecting room:', error);
					const chatDiv = document.getElementById('chat');
					if (chatDiv) {
							chatDiv.innerHTML = '<p class="text-red-500">Erreur de chargement des messages</p>';
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

			// Envoi JSON attendu par ton serveur WS
			socket.send(JSON.stringify({
				chatRoomID: currentRoom,
				userID: userId,
				content: content
			}));

			// Optionnel : afficher immédiatement en local
			const chatDiv = document.getElementById('chat');
			const p = document.createElement('p');
			p.textContent = `Moi: ${content}`;
			chatDiv.appendChild(p);

			chatForm.reset();
		});
	}
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
			err.textContent = 'Erreur d’inscription';
			err.classList.remove('hidden');
		}
	};
}

function setupLoginHandlers() {
	const form = document.getElementById('loginForm');
	if (!form) return;

	form.onsubmit = async e => {
		e.preventDefault();
		// we get username/pass from login form
		const data = Object.fromEntries(new FormData(form).entries());
		// save pseudo in cookie to render on home
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
					pendingToken = json.token;
					await doSetup2FA(pendingToken);
				} else if (json.need2FAVerify) {
					pendingToken = json.token;
					render(Verify2FAView());
					setupVerify2FAHandlers();
				}
			} else {
				// render error in <p id="login-error">
				const err = document.getElementById('login-error');
				err.textContent = json.error || 'Erreur de connexion';
				err.classList.remove('hidden');
			}
		} catch (err) {
			const errEl = document.getElementById('login-error');
			errEl.textContent = 'Erreur réseau, réessayez.';
			errEl.classList.remove('hidden');
		}
	};
}


async function doSetup2FA(token) {
	try {
		const res = await fetch('/api/auth/2fa/setup', {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}` }
		});
		const json = await res.json();
		if (!res.ok) throw new Error(json.error);
		render(Setup2FAView(json.otpauth_url, json.base32));
		setupSetup2FAHandlers();
	} catch (err) {
		render(`
			<div class="max-w-md mx-auto mt-12 bg-white p-8 rounded shadow">
				<p class="text-red-500">Impossible de configurer 2FA. Réessayez.</p>
				<button id="back-login" class="mt-4 w-full py-2 px-4 bg-indigo-600 text-black rounded">
					Retour
				</button>
			</div>
		`);
		document.getElementById('back-login')
						.addEventListener('click', () => { history.pushState(null,'','/login'); router(); });
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
			alert('Erreur lors de la vérification 2FA');
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
				initWebSocket(); // start websocket
				window.location.href = '/';
			} else {
				const err = document.getElementById('verify-error');
				err.textContent = json.error;
				err.classList.remove('hidden');
			}
		} catch {
			alert('Erreur lors de la vérification 2FA');
		}
	};
}

// ─── WEBSOCKETS ────────────────────────────────────────────────────────────────


// Initialize WS if both userId and authtoken are setup
function initWebSocket() {
    if (!authToken) {
        console.warn('WebSocket: pas de token d\'authentification');
        return;
    }

    userId = getUserIdFromCookie();
    if (!userId) {
        console.warn('WebSocket: userId manquant dans le cookie');
        // Optionnel : tenter de récupérer l'userId via une requête API
        return;
    }

    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${location.host}/?token=${authToken}`;
    
    try {
        socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
            console.log('WebSocket connecté');
        };
        
        socket.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                handleWebSocketMessage(msg);
            } catch (error) {
                console.warn('Message WebSocket invalide:', error);
            }
        };
        
        socket.onclose = (event) => {
            console.log('WebSocket déconnecté:', event.reason);
        };
        
        socket.onerror = (error) => {
            console.error('Erreur WebSocket:', error);
        };
    } catch (error) {
        console.error('Erreur lors de l\'initialisation du WebSocket:', error);
    }
}

// Auxilliary function to handle websocket messages
function handleWebSocketMessage(msg) {
    const chatDiv = document.getElementById('chat');
    if (!chatDiv) return;

    switch (msg.type) {
        case 'system':
            const systemMsg = document.createElement('p');
            systemMsg.className = 'italic text-gray-500';
            systemMsg.textContent = msg.message;
            chatDiv.appendChild(systemMsg);
            break;
            
        case 'chatRoomMessage':
            if (msg.roomID === currentRoom) {
                const messageP = document.createElement('p');
                messageP.textContent = `${msg.from === userId ? 'Moi' : msg.from}: ${msg.content}`;
                chatDiv.appendChild(messageP);
            }
            break;
            
        default:
            console.warn('Type de message WebSocket non géré:', msg.type);
    }
}