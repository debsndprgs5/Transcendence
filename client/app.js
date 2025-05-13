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
    <!------ Game ------>
    <div class="grid gap-6 md:grid-cols-2">
      <div class="bg-white p-6 rounded-lg shadow-lg flex flex-col">
        <h2 class="text-2xl font-semibold text-indigo-600 mb-4">Parties disponibles</h2>
        <div id="games-list" class="flex-1 overflow-auto space-y-3"></div>
        <button id="newGameBtn"
                class="mt-4 px-4 py-2 bg-green-500 text-black rounded-lg hover:bg-green-600 transition">
          + Créer une partie
        </button>
      </div>
      <!------ Chat ------>
      <div class="bg-white p-6 rounded-lg shadow-lg flex flex-col">
        <h2 class="text-2xl font-semibold text-indigo-600 mb-4">Chat</h2>
        <div id="chat" class="flex-1 overflow-auto space-y-2 mb-4"></div>
        <form id="chatForm" class="flex space-x-2">
          <input name="message" placeholder="Écrire un message…"
                 class="flex-1 border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-300" />
          <button type="submit"
                  class="px-4 py-2 bg-indigo-600 text-black rounded-lg hover:bg-indigo-700 transition">
            Envoyer
          </button>
        </form>
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

	// "Create game" button -> a modifier pour integrer le jeu
	const newGameBtn = document.getElementById('newGameBtn');
	if (newGameBtn) {
		newGameBtn.addEventListener('click', () => {
			// call API to create a new game soon inshallah
			console.log('Create new game clicked');
		});
	}

	// Chat form submission -> a modifier pour integrer chat
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
