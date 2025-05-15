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
					<button id="generalChatBtn" 
							class="text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer">
						Chat
					</button>
					<button id="newChatRoomBtn" 
							class="px-3 py-1 bg-indigo-100 text-indigo-600 rounded hover:bg-indigo-200 transition text-sm">
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
		default:
			render(HomeView());
			if (isAuthenticated()) {
				setupHomeHandlers();
				// Reset currentRoom
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
		
		if (response.status === 401) {
			// Unauthorized, token is invalid or expired
			handleLogout();
			throw new Error('Session expired. Please log in again.');
		}
		
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
	if (!isAuthenticated()) {
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
	// "Create game" button -> a modifier pour integrer le jeu
	const newGameBtn = document.getElementById('newGameBtn');
	if (newGameBtn) {
		newGameBtn.addEventListener('click', () => {
			// call API to create a new game soon inshallah
			console.log('Create new game clicked');
		});
	}

  // Load rooms immediately when entering home view
	let loadRooms = async () => {
		try {
			const rooms = await apiFetch('/api/chat/rooms', { 
				headers: { 'Authorization': `Bearer ${authToken}` } 
			});
			const ul = document.getElementById('room-list');
			if (!ul) return;
			
			ul.innerHTML = rooms.map(r => 
				`<li data-id="${r.roomID}" class="cursor-pointer hover:bg-gray-100 p-2 rounded ${currentRoom === r.roomID ? 'bg-indigo-100' : ''}">${r.name || `Salon #${r.roomID}`}</li>`
			).join('');
			
			// If no room is selected, select general
			if (currentRoom === 0 && rooms.length > 0) {
				currentRoom = rooms[0].roomID;
			}
			
			// Event listeners
			document.querySelectorAll('#room-list li').forEach(li => {
				li.addEventListener('click', () => selectRoom(Number(li.dataset.id)));
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
				ul.innerHTML = '<li class="text-red-500">Erreur de chargement des salons</li>';
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
				const roomName = prompt('Nom du salon :') || 'Nouveau salon';
				const newroom = await apiFetch('/api/chat/rooms', { 
					method: 'POST', 
					headers: { 
						'Authorization': `Bearer ${authToken}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ name: roomName })
				});
				addMemberToRoom(newroom.roomID);
				await loadRooms(); // Reload room list after creating one
			} catch (error) {
				console.error('Error creating chat room:', error);
				alert('Erreur lors de la création du salon: ' + error.message);
			}
		});
	}

	async function addMemberToRoom(roomId) {
	    try {
	        await apiFetch(`/api/chat/rooms/${roomId}/members`, { 
	            method: 'POST',
	            headers: { 
	                'Authorization': `Bearer ${authToken}`,
	                'Content-Type': 'application/json'
	            }
	        });
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
			
			// Update visually the selected room
			document.querySelectorAll('#room-list li').forEach(li => {
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
				type : 'chatRoomMessage',
				chatRoomID: currentRoom,
				userID: userId,
				content: content
			}));

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
				err.textContent = json.error || 'Erreur de connexion';
				err.classList.remove('hidden');
			}
		} catch (err) {
			console.error('Login error:', err);
			const errEl = document.getElementById('login-error');
			errEl.textContent = 'Erreur réseau, réessayez.';
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
				<p class="text-red-500">Impossible de configurer 2FA. Erreur: ${err.message}</p>
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
				
				// Rediriger vers la page d'accueil
				history.pushState(null, '', '/');
				router();
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
			console.log('WebSocket connecté');

			setTimeout(() => {
				if (socket.readyState === WebSocket.OPEN) {
					console.log('Sending chatHistory request...');
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
				console.error('Erreur de parsing du message WebSocket:', e);
			}
		};

		socket.onclose = (event) => {
			console.log('WebSocket déconnecté:', event.code, event.reason);
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