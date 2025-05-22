import { createDirectMessageWith, router } from './handlers.js';


// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────────

export function getNotificationContainer() {
	let container = document.getElementById('notif-container');
	if (!container) {
	container = document.createElement('div');
	container.id = 'notif-container';
	container.className = 'fixed top-5 right-5 flex flex-col space-y-3 z-50';
	document.body.appendChild(container);
	}
	return container;
}

export function showNotification({
	message = '',
	type = 'info',       // success, error, info, warning, prompt, confirm
	duration = 3000,     // ignored if type === 'prompt' ou 'confirm'
	placeholder = '',    // only for prompt
	onConfirm = null,    // callback(value) for prompt
	onCancel = null,     // callback() for prompt
}) {
	if (type === 'prompt') {
		// Prompt
		const overlay = document.createElement('div');
		overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]';

		const modal = document.createElement('div');
		modal.className = 'bg-white rounded-lg p-6 max-w-sm w-full shadow-lg flex flex-col space-y-4';

		const msg = document.createElement('p');
		msg.className = 'text-gray-800 text-lg';
		msg.textContent = message;

		const input = document.createElement('input');
		input.type = 'text';
		input.placeholder = placeholder;
		input.className = 'border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500';

		const buttons = document.createElement('div');
		buttons.className = 'flex justify-end space-x-3';

		const btnCancel = document.createElement('button');
		btnCancel.textContent = 'Cancel';
		btnCancel.className = 'px-4 py-2 rounded bg-gray-300 hover:bg-gray-400 text-gray-800';
		btnCancel.onclick = () => {
			document.body.removeChild(overlay);
			if (onCancel) onCancel();
		};

		const btnOk = document.createElement('button');
		btnOk.textContent = 'Confirm';
		btnOk.className = 'px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white';
		btnOk.onclick = () => {
			const val = input.value;
			document.body.removeChild(overlay);
			if (onConfirm) onConfirm(val);
		};

		buttons.appendChild(btnCancel);
		buttons.appendChild(btnOk);

		modal.appendChild(msg);
		modal.appendChild(input);
		modal.appendChild(buttons);

		overlay.appendChild(modal);
		document.body.appendChild(overlay);

		input.focus();

		return; // prompt dont create normal notif
	}

	if (type === 'confirm') {
		// Confirmation
		const overlay = document.createElement('div');
		overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]';

		const modal = document.createElement('div');
		modal.className = 'bg-white rounded-lg p-6 max-w-sm w-full shadow-lg flex flex-col space-y-4';

		const msg = document.createElement('p');
		msg.className = 'text-gray-800 text-lg';
		msg.textContent = message;

		const buttons = document.createElement('div');
		buttons.className = 'flex justify-end space-x-3';

		const btnCancel = document.createElement('button');
		btnCancel.textContent = 'Cancel';
		btnCancel.className = 'px-4 py-2 rounded bg-gray-300 hover:bg-gray-400 text-gray-800';
		btnCancel.onclick = () => {
			document.body.removeChild(overlay);
			if (onCancel) onCancel();
		};

		const btnOk = document.createElement('button');
		btnOk.textContent = 'Confirm';
		btnOk.className = 'px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white';
		btnOk.onclick = () => {
			document.body.removeChild(overlay);
			if (onConfirm) onConfirm();
		};

		buttons.appendChild(btnCancel);
		buttons.appendChild(btnOk);

		modal.appendChild(msg);
		modal.appendChild(buttons);

		overlay.appendChild(modal);
		document.body.appendChild(overlay);

		return; // confirm dont create normal notif
	}

	// Normal notif
	const container = getNotificationContainer();

	const colors = {
		success: 'bg-green-500',
		error: 'bg-red-500',
		info: 'bg-blue-500',
		warning: 'bg-yellow-400 text-black',
	};

	const notif = document.createElement('div');
	notif.className = `
		max-w-xs w-full text-white px-4 py-3 rounded shadow-lg flex items-center space-x-3 cursor-pointer
		${colors[type] || colors.info}
		transform transition duration-300 ease-in-out
		hover:brightness-90
	`;

	notif.textContent = message;

	notif.addEventListener('click', () => {
		notif.remove();
	});

	container.appendChild(notif);

	notif.style.opacity = 0;
	notif.style.transform = 'translateX(100%)';
	setTimeout(() => {
		notif.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
		notif.style.opacity = 1;
		notif.style.transform = 'translateX(0)';
	}, 10);

	setTimeout(() => {
		notif.style.opacity = 0;
		notif.style.transform = 'translateX(100%)';
		setTimeout(() => {
			notif.remove();
		}, 300);
	}, duration);
}

// Show a floating action bubble below the clicked username
export function showUserActionsBubble(target, username) {
	// Remove any old bubble
	document.querySelectorAll('.user-action-bubble').forEach(el => el.remove());

	// Find the container (the .flex-1 or the parent of #chat)
	const chatDiv = document.getElementById('chat');
	const parent = chatDiv.parentElement;

	if (parent && window.getComputedStyle(parent).position === "static") {
		parent.style.position = "relative";
	}

	// Create the bubble
	const bubble = document.createElement('div');
	bubble.className = 'user-action-bubble';

	// Content with icons and a separator
	bubble.innerHTML = `
		<svg class="user-action-bubble__arrow" viewBox="0 0 28 13" fill="none">
			<path d="M14 13L0 0h28L14 13z" fill="#fff" stroke="#a5b4fc" stroke-width="1.5"/>
		</svg>
		<button data-action="profile">👤 <span>Profile</span></button>
		<button data-action="dm">💬 <span>Direct Message</span></button>
		<button data-action="invite" disabled>🎮 <span>Invite Game</span></button>
	`;

	// Append to parent
	parent.appendChild(bubble);

	// Position (below pseudo, arrow included)
	const parentRect = parent.getBoundingClientRect();
	const targetRect = target.getBoundingClientRect();
	const bubbleRect = bubble.getBoundingClientRect();

	const top = targetRect.bottom - parentRect.top + parent.scrollTop + 12;
	let left = targetRect.left - parentRect.left + parent.scrollLeft - 18; // slight offset
	// Prevent overflow right
	const maxLeft = parent.offsetWidth - bubble.offsetWidth - 12;
	if (left > maxLeft) left = maxLeft;
	if (left < 8) left = 8;
	bubble.style.top = `${top}px`;
	bubble.style.left = `${left}px`;

	// Position the arrow under the target
	const arrow = bubble.querySelector('.user-action-bubble__arrow');
	if (arrow) {
		let arrowLeft = targetRect.left - parentRect.left + (targetRect.width / 2) - left - 14; // 14 = arrow width/2
		if (arrowLeft < 8) arrowLeft = 8;
		arrow.style.left = `${arrowLeft}px`;
	}

	// Close bubble on outside click
	setTimeout(() => {
		document.addEventListener('mousedown', function onClickOutside(e) {
			if (!bubble.contains(e.target)) {
				bubble.remove();
				document.removeEventListener('mousedown', onClickOutside);
			}
		});
	}, 20);

	// Actions
	bubble.addEventListener('click', async function(e) {
		const action = e.target.closest('button')?.getAttribute('data-action');
		if (!action) return;
		if (action === 'profile') {
			history.pushState(null, '', `/profile/${encodeURIComponent(username)}`);
			router();
			bubble.remove();
		} else if (action === 'dm') {
			await createDirectMessageWith(username);
			bubble.remove();
		}
		// "invite" does nothing
	});
}