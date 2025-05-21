import { router, startTokenValidation, updateNav } from './handlers.js';
import { isAuthenticated } from './api.js';

// Init SPA
document.addEventListener('DOMContentLoaded', () => {
  router();
  startTokenValidation();
});

// Navigation SPA
window.addEventListener('popstate', router);

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (!a) return;
  e.preventDefault();
  history.pushState(null, '', a.pathname);
  router();
});

// Navigation top-bar (update après chaque render)
window.updateNav = updateNav;