// ─── AUTH STATE ──────────────────────────────────────────────────────────────
let authToken    = localStorage.getItem('token');
let pendingToken = null;

// ─── RENDER ──────────────────────────────────────────────────────────────────
function render(html) {
	const app = document.getElementById('app');
	if (app) app.innerHTML = html;
}

// ─── VIEWS ────────────────────────────────────────────────────────────────────

function HomeView() {
	if (!authToken) {
		// non connecté → le hero
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
					<img src="https://tailwindcss.com/_next/static/media/pong.123456.png"
							 alt="Pong illustration"
							 class="w-3/4 h-auto">
				</div>
			</section>
		`;
	}

	// connecté → lobby + bouton Déconnexion + message perso
  const userName = localStorage.getItem('username') || '';
  return `
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-semibold text-indigo-600">
        Bienvenue, <span class="font-bold">${userName}</span> !
      </h1>
      <button id="logoutBtn"
              class="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition">
        Déconnexion
      </button>
    </div>
    <div class="grid gap-6 md:grid-cols-2">
			<!-- … le reste de ton lobby (games-list, chatForm, etc.) … -->
		</div>
	`;
}

function LoginView() {
	return `
		<div class="max-w-md mx-auto mt-12 bg-white shadow-lg rounded-lg overflow-hidden">
			<div class="px-6 py-4 bg-indigo-50">
				<h2 class="text-2xl font-bold text-indigo-700">Connexion</h2>
			</div>
			<form id="loginForm" class="px-6 py-4 space-y-4">
				<div>
					<label class="block text-sm font-medium text-gray-700">Nom d’utilisateur</label>
					<input name="username" required
								 class="mt-1 block w-full border-gray-300 rounded-md shadow-sm 
												focus:ring-indigo-500 focus:border-indigo-500" />
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700">Mot de passe</label>
					<input type="password" name="password" required
								 class="mt-1 block w-full border-gray-300 rounded-md shadow-sm 
												focus:ring-indigo-500 focus:border-indigo-500" />
				</div>
				<button type="submit"
								class="w-full py-2 px-4 bg-indigo-600 text-white font-semibold 
											 rounded-md hover:bg-indigo-700 transition">
					Se connecter
				</button>
				<p id="login-error" class="text-red-500 text-sm mt-2 hidden"></p>
			</form>
			<div class="px-6 py-4 bg-gray-50 text-center">
				<p class="text-sm">
					Vous n’avez pas de compte ?
					<a href="/register" data-link class="text-indigo-600 hover:underline">Inscrivez-vous</a>
				</p>
			</div>
		</div>
	`;
}

function RegisterView() {
	return `
		<div class="max-w-md mx-auto mt-12 bg-white shadow-lg rounded-lg overflow-hidden">
			<div class="px-6 py-4 bg-green-50">
				<h2 class="text-2xl font-bold text-green-700">Inscription</h2>
			</div>
			<form id="registerForm" class="px-6 py-4 space-y-4">
				<div>
					<label class="block text-sm font-medium text-gray-700">Nom d’utilisateur</label>
					<input name="username" required
								 class="mt-1 block w-full border-gray-300 rounded-md shadow-sm 
												focus:ring-green-500 focus:border-green-500" />
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700">Mot de passe</label>
					<input type="password" name="password" required
								 class="mt-1 block w-full border-gray-300 rounded-md shadow-sm 
												focus:ring-green-500 focus:border-green-500" />
				</div>
				<button type="submit"
								class="w-full py-2 px-4 bg-green-600 text-black font-semibold 
											 rounded-md hover:bg-green-700 transition">
					Créer mon compte
				</button>
				<p id="register-error" class="text-red-500 text-sm mt-2 hidden"></p>
			</form>
			<div class="px-6 py-4 bg-gray-50 text-center">
				<p class="text-sm">
					Déjà un compte ?
					<a href="/login" data-link class="text-green-600 hover:underline">Connectez-vous</a>
				</p>
			</div>
		</div>
	`;
}

function Setup2FAView(otpauth_url, base32) {
	// on utilise QuickChart pour générer le QR code
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
  const token = localStorage.getItem('token');

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

// ─── HANDLERS ────────────────────────────────────────────────────────────────
function setupHomeHandlers() {
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

	// "Create game" button (stub)
	const newGameBtn = document.getElementById('newGameBtn');
	if (newGameBtn) {
		newGameBtn.addEventListener('click', () => {
			// TODO: call your API to create a new game
			console.log('Create new game clicked');
		});
	}

	// Chat form submission
	const chatForm = document.getElementById('chatForm');
	if (chatForm) {
		chatForm.addEventListener('submit', async e => {
			e.preventDefault();
			const formData = new FormData(chatForm);
			const message  = formData.get('message');
			if (!message) return;
			// send to backend
			try {
				await apiFetch('/api/chat', {
					method: 'POST',
					headers: { 'Authorization': `Bearer ${authToken}` },
					body: JSON.stringify({ message })
				});
				// append to chat window
				const chatDiv = document.getElementById('chat');
				if (chatDiv) {
					const p = document.createElement('p');
					p.textContent = message;
					chatDiv.appendChild(p);
				}
				chatForm.reset();
			} catch (err) {
				console.error('Chat send error', err);
			}
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
    // on récupère username/password
    const data = Object.fromEntries(new FormData(form).entries());
    // et on sauvegarde le pseudo pour l'afficher plus tard
    localStorage.setItem('username', data.username);

    try {
      // un seul fetch, avec les vraies options
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
        // afficher l’erreur dans le <p id="login-error">
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
