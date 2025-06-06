import { createDirectMessageWith, router } from './handlers';
import { apiFetch, state } from './api';

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────────

export function getNotificationContainer(): HTMLDivElement {
	let container = document.getElementById('notif-container') as HTMLDivElement | null;
	if (!container) {
		container = document.createElement('div');
		container.id = 'notif-container';
		container.className = 'fixed top-5 right-5 flex flex-col space-y-3 z-50';
		document.body.appendChild(container);
	}
	return container;
}

interface NotificationOptions {
	message?: string;
	type?: 'success' | 'error' | 'info' | 'warning' | 'prompt' | 'confirm';
	duration?: number;
	placeholder?: string;
	onConfirm?: ((value?: string) => void) | null;
	onCancel?: (() => void) | null;
}

export function showNotification({
	message = '',
	type = 'info',
	duration = 3000,
	placeholder = '',
	onConfirm = null as ((value?: string) => void) | null,
	onCancel  = null as (() => void) | null,
}: NotificationOptions): void {
	if (type === 'prompt') {
		// Prompt modal
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
		input.className =
			'border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500';

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
		return; // prompt does not create normal notification
	}

	if (type === 'confirm') {
		// Confirmation modal
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

		return; // confirm does not create normal notification
	}

	// Normal notification
	const container = getNotificationContainer();

	const colors: Record<string, string> = {
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

	notif.style.opacity = '0';
	notif.style.transform = 'translateX(100%)';
	setTimeout(() => {
		notif.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
		notif.style.opacity = '1';
		notif.style.transform = 'translateX(0)';
	}, 10);

	setTimeout(() => {
		notif.style.opacity = '0';
		notif.style.transform = 'translateX(100%)';
		setTimeout(() => {
			notif.remove();
		}, 300);
	}, duration);
}

// Show a floating action bubble below the clicked username

export function showUserActionsBubble(target: Element, username: string): void {
	// Delete any previous bubble
	document.querySelectorAll('.user-action-bubble').forEach(el => el.remove());

	const chatDiv = document.getElementById('chat');
	const parent = chatDiv?.parentElement;
	if (parent && window.getComputedStyle(parent).position === 'static') {
		parent.style.position = 'relative';
	}

	// Make the bubble's html container
	const bubble = document.createElement('div');
	bubble.className = 'user-action-bubble';
	bubble.innerHTML = `
		<svg class="user-action-bubble__arrow" viewBox="0 0 28 13" fill="none">
			<path d="M14 13L0 0h28L14 13z" fill="#fff" stroke="#a5b4fc" stroke-width="1.5"/>
		</svg>
		<button data-action="profile">👤 <span>Profile</span></button>
		<button data-action="dm">💬 <span>Direct Message</span></button>
		<button data-action="invite">🎮 <span>Invite Game</span></button>
	`;
	parent?.appendChild(bubble);

	// put the bubble under the clicked element
	const parentRect = parent!.getBoundingClientRect();
	const targetRect = (target as Element).getBoundingClientRect();
	const bubbleRect = bubble.getBoundingClientRect();

	const top = targetRect.bottom - parentRect.top + parent!.scrollTop + 12;
	let left = targetRect.left - parentRect.left + parent!.scrollLeft - 18;
	const maxLeft = parent!.offsetWidth - bubbleRect.width - 12;
	if (left > maxLeft) left = maxLeft;
	if (left < 8) left = 8;
	bubble.style.top = `${top}px`;
	bubble.style.left = `${left}px`;

	// Arrow pointing to clicked user
	const arrow = bubble.querySelector<SVGElement>('.user-action-bubble__arrow');
	if (arrow) {
		let arrowLeft = targetRect.left - parentRect.left + targetRect.width / 2 - left - 14;
		if (arrowLeft < 8) arrowLeft = 8;
		arrow.style.left = `${arrowLeft}px`;
	}

	// Close bubble if you click outside
	setTimeout(() => {
		document.addEventListener('mousedown', function onClickOutside(e) {
			if (!bubble.contains(e.target as Node)) {
				bubble.remove();
				document.removeEventListener('mousedown', onClickOutside);
			}
		});
	}, 20);

	// Handling buttons actions
	bubble.addEventListener('click', async (e: MouseEvent) => {
		const btn = (e.target as HTMLElement).closest('button');
		const action = btn?.getAttribute('data-action');
		if (!action) return;

		if (action === 'profile') {
			history.pushState(null, '', `/profile/${encodeURIComponent(username)}`);
			router()
			bubble.remove();

		} else if (action === 'dm') {
			await createDirectMessageWith(username);
			bubble.remove();

		} else if (action === 'invite') {
			// get the id of clicked user
			let targetUserID: number;
			try {
				const resp = await apiFetch(`/api/users/by-username/${encodeURIComponent(username)}`, {
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${state.authToken}`
					}
				});
				targetUserID = resp.userId as number;
			} catch (err) {
				console.error('Error getting ID of clicked user :', err);
				showNotification({ message: 'Unable to find this user', type: 'error' });
				bubble.remove();
				return;
			}

			// Create a private room
			let newGameID: number;
			let newGameName: string;
			try {
				const createResp = await apiFetch(`/api/pong/${state.userId}`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${state.authToken}`
					},
					body: JSON.stringify({
						userID: state.userId,
						name: 'Private Room',
						ball_speed: 50,
						paddle_speed: 50
					})
				});
				newGameID = (createResp.room.gameID as number);
				newGameName = (createResp.room.gameName as string);
			} catch (err) {
				console.error('Error while creating “Private Room” :', err);
				showNotification({ message: 'Create private room failed', type: 'error' });
				bubble.remove();
				return;
			}

			// Send websocket notif to clicked user
			if (state.gameSocket) {
				state.gameSocket.send(JSON.stringify({
					type: 'invite',
					action: 'send',
					toUserID: targetUserID,
					fromUserID: state.userId,
					fromUsername: username, 
					gameID: newGameID,
					gameName: newGameName
				}));
			} else {
				console.warn('No open websocket to send invite');
			}

			bubble.remove();
		}
	});
}
