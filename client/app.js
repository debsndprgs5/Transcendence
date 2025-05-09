// injection de contenu
function render(html) {
  document.getElementById('app').innerHTML = html;
}

// deux “vues” simples
function HomeView() {
  return `
    <h1 class="text-3xl font-bold text-primary">Accueil</h1>
    <p>Bienvenue sur Transcendence SPA !</p>
  `;
}
function LoginView() {
  return `
    <h1 class="text-3xl font-bold text-primary">Connexion</h1>
    <form id="loginForm" class="space-y-4">
      <input name="username" placeholder="Utilisateur" class="border p-2 w-full" /><br/>
      <input type="password" name="password" placeholder="Mot de passe" class="border p-2 w-full" /><br/>
      <button class="w-full px-4 py-2 bg-accent text-white rounded">Envoyer</button>
    </form>
  `;
}

// routeur très basique
function router() {
  const path = window.location.pathname;
  if (path === '/login') render(LoginView());
  else render(HomeView());
}

// interception des liens “data-link”
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-link]');
  if (a) {
    e.preventDefault();
    history.pushState(null, '', a.pathname);
    router();
  }
});
window.addEventListener('popstate', router);

// premier rendu
router();
