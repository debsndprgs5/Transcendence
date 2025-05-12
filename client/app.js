// Auth state
let authToken = localStorage.getItem('token');


// Rendering function to insert HTML
function render(content) {
  const app = document.getElementById('app');
  if (app) {
      app.innerHTML = content;
  }
}

// Views
function HomeView() {
    if (!authToken) {
        return `
            <div class="max-w-2xl mx-auto text-center">
                <h1 class="text-4xl font-bold text-primary mb-8">Bienvenue sur Transcendence</h1>
                <div class="space-y-4">
                    <a href="/register" data-link class="block w-full px-4 py-2 bg-accent text-white rounded">Créer un compte</a>
                    <a href="/login" data-link class="block w-full px-4 py-2 bg-primary text-white rounded">Se connecter</a>
                </div>
            </div>
        `;
    }
    return `
        <div class="max-w-4xl mx-auto">
            <h1 class="text-3xl font-bold text-primary mb-6">Lobby</h1>
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-white p-6 rounded shadow">
                    <h2 class="text-xl font-semibold mb-4">Parties disponibles</h2>
                    <div id="games-list">
                        <!-- Liste des parties -->
                    </div>
                </div>
                <div class="bg-white p-6 rounded shadow">
                    <h2 class="text-xl font-semibold mb-4">Chat</h2>
                    <div id="chat">
                        <!-- Chat -->
                    </div>
                </div>
            </div>
        </div>
    `;
}

function LoginView() {
    return `
        <div class="max-w-md mx-auto bg-white p-8 rounded shadow">
            <h1 class="text-3xl font-bold text-primary mb-6">Connexion</h1>
            <form id="loginForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-1">Nom d'utilisateur</label>
                    <input name="username" class="border p-2 w-full rounded" required />
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">Mot de passe</label>
                    <input type="password" name="password" class="border p-2 w-full rounded" required />
                </div>
                <button type="submit" class="w-full px-4 py-2 bg-accent text-white rounded">Se connecter</button>
                <div id="login-error" class="text-red-500 text-sm hidden"></div>
            </form>
            <div id="twofa-form" class="hidden space-y-4 mt-4">
                <input type="text" id="2fa-code" placeholder="Code 2FA" class="border p-2 w-full rounded" />
                <button id="verify-2fa-btn" class="w-full px-4 py-2 bg-accent text-white rounded">Vérifier 2FA</button>
            </div>
        </div>
    `;
}

function RegisterView() {
    return `
        <div class="max-w-md mx-auto bg-white p-8 rounded shadow">
            <h1 class="text-3xl font-bold text-primary mb-6">Inscription</h1>
            <form id="registerForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-1">Nom d'utilisateur</label>
                    <input name="username" class="border p-2 w-full rounded" required />
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">Mot de passe</label>
                    <input type="password" name="password" class="border p-2 w-full rounded" required />
                </div>
                <button type="submit" class="w-full px-4 py-2 bg-accent text-white rounded">S'inscrire</button>
                <div id="register-error" class="text-red-500 text-sm hidden"></div>
            </form>
        </div>
    `;
}

// Router
function router() {
    const path = window.location.pathname;
    switch (path) {
        case '/login': render(LoginView()); setupLoginHandlers(); break;
        case '/register': render(RegisterView()); setupRegisterHandlers(); break;
        default: render(HomeView()); break;
    }
}

// Register handlers
function setupRegisterHandlers() {
  const form = document.getElementById('registerForm');
  if (form) {
      form.onsubmit = async (e) => {
          e.preventDefault();
          const formData = new FormData(form);
          try {
              const response = await fetch('/api/auth/register', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      username: formData.get('username'),
                      password: formData.get('password')
                  })
              });
              
              const data = await response.json();
              if (response.ok) {
                  // Redirect to login after successful registration
                  history.pushState(null, '', '/login');
                  router();
              } else {
                  document.getElementById('register-error').textContent = data.error;
                  document.getElementById('register-error').classList.remove('hidden');
              }
          } catch (err) {
              document.getElementById('register-error').textContent = "Erreur d'inscription";
              document.getElementById('register-error').classList.remove('hidden');
          }
      };
  }
}

// Auth handlers
function setupLoginHandlers() {
    const form = document.getElementById('loginForm');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: formData.get('username'),
                        password: formData.get('password')
                    })
                });
                const data = await response.json();
                
                if (data.need2FASetup) {
                    // Redirect to 2FA setup
                    setup2FA(data.token);
                } else if (data.need2FAVerify) {
                    // Show 2FA verification form
                    document.getElementById('twofa-form').classList.remove('hidden');
                    localStorage.setItem('pendingToken', data.token);
                }
            } catch (err) {
                document.getElementById('login-error').textContent = "Erreur de connexion";
                document.getElementById('login-error').classList.remove('hidden');
            }
        };
    }
    const verify2FABtn = document.getElementById('verify-2fa-btn');
    if (verify2FABtn) {
        verify2FABtn.addEventListener('click', verify2FA);
    }
}

// 
async function verify2FA() {
    const code = document.getElementById('2fa-code').value;
    const pendingToken = localStorage.getItem('pendingToken');
    
    try {
        const response = await fetch('/api/auth/2fa/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${pendingToken}`
            },
            body: JSON.stringify({ code })
        });
        
        const data = await response.json();
        if (data.token) {
            localStorage.setItem('token', data.token);
            localStorage.removeItem('pendingToken');
            window.location.href = '/';
        }
    } catch (err) {
        console.error('2FA verification failed', err);
    }
}

// Setup 2FA after first login
async function setup2FA(token) {
    try {
        const response = await fetch('/api/auth/2fa/setup', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        if (response.ok) {
            const qrCodeUrl = `https://quickchart.io/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(data.otpauth_url)}`;
            
            render(`
                <div class="max-w-md mx-auto bg-white p-8 rounded shadow">
                    <h1 class="text-3xl font-bold text-primary mb-6">Configuration 2FA</h1>
                    <div class="space-y-4">
                        <p class="text-sm text-gray-600">Scannez ce QR code avec votre application d'authentification :</p>
                        <img src="${qrCodeUrl}" alt="QR Code" class="mx-auto" />
                        <p class="text-sm text-gray-600">Ou entrez ce code manuellement :</p>
                        <code class="block p-2 bg-gray-100 rounded text-center">${data.base32}</code>
                        <div class="mt-6">
                            <input type="text" id="2fa-setup-code" placeholder="Entrez le code" class="border p-2 w-full rounded" />
                            <button id="verify-setup-2fa-btn" class="w-full mt-2 px-4 py-2 bg-accent text-white rounded">
                                Vérifier
                            </button>
                        </div>
                    </div>
                </div>
            `);

            // Add event listener after rendering
            const verifyBtn = document.getElementById('verify-setup-2fa-btn');
            if (verifyBtn) {
                verifyBtn.addEventListener('click', () => verifySetup2FA(token));
            }
        } else {
            throw new Error(data.error || 'Failed to setup 2FA');
        }
    } catch (err) {
        console.error('2FA setup failed:', err);
        render(`
            <div class="max-w-md mx-auto bg-white p-8 rounded shadow">
                <div class="text-red-500">Erreur lors de la configuration 2FA. Veuillez réessayer.</div>
                <button id="back-to-login" class="mt-4 w-full px-4 py-2 bg-accent text-white rounded">
                    Retour
                </button>
            </div>
        `);
        
        // Add event listener for back button
        const backBtn = document.getElementById('back-to-login');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                history.pushState(null, '', '/login');
                router();
            });
        }
    }
}

// Verify the 2fa setup
async function verifySetup2FA(token) {
    const code = document.getElementById('2fa-setup-code').value;
    
    try {
        const response = await fetch('/api/auth/2fa/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ code })
        });
        
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('token', data.token);
            window.location.href = '/';
        } else {
            throw new Error(data.error || 'Failed to verify 2FA code');
        }
    } catch (err) {
        console.error('2FA verification failed:', err);
        alert('Code incorrect. Veuillez réessayer.');
    }
}

// Event listeners
document.addEventListener('click', e => {
    if (e.target.matches('[data-link]')) {
        e.preventDefault();
        history.pushState(null, '', e.target.href);
        router();
    }
});

window.addEventListener('popstate', router);
window.addEventListener('DOMContentLoaded', router);