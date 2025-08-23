import { router, startTokenValidation, updateNav } from './handlers';
import { isAuthenticated } from './api';

// Augment Window interface to include updateNav
declare global {
	interface Window {
		updateNav: typeof updateNav;
	}
}

// Init SPA
document.addEventListener('DOMContentLoaded', () => {
	router();
	startTokenValidation();
});

// Navigation SPA: handle browser back/forward
window.addEventListener('popstate', router);

// Delegate link clicks to SPA router
document.addEventListener('click', (e: MouseEvent) => {
	const target = e.target as HTMLElement;
	const a = target.closest('a[data-link]') as HTMLAnchorElement | null;
	if (!a) return;
	e.preventDefault();
	history.pushState(null, '', a.pathname);
	router();
});

// Navigation top-bar (update after each render)
window.updateNav = updateNav;
