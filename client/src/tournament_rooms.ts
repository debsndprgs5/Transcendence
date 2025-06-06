import { showNotification } from './notifications';
import { state, apiFetch } from './api';
import { createTournamentFormData, showPongMenu, PongButton, fetchOpenTournaments } from './pong_rooms';

// MENU HANDLERS 

export async function handleTournamentClick(
	canvas: HTMLCanvasElement,
	x: number,
	y: number
): Promise<void> {
	// handle clicks in the "Tournament" view
	const btns = (canvas as any)._tournamentButtons as PongButton[] | undefined;
	if (!btns) return;

	const clickedBtn = btns.find(b =>
		x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
	);
	if (!clickedBtn) return;

	if (clickedBtn.action === 'editTournamentName') {
		showNotification({
			message: 'Enter tournament name:',
			type: 'prompt',
			placeholder: 'Tournament Name',
			onConfirm: val => {
				createTournamentFormData.tournamentName = val ?? null;
				showPongMenu();
			}
		});
	}
	else if (clickedBtn.action === 'ballSpeedUp') {
		createTournamentFormData.ballSpeed = Math.min(100, createTournamentFormData.ballSpeed + 1);
		showPongMenu();
	}
	else if (clickedBtn.action === 'ballSpeedDown') {
		createTournamentFormData.ballSpeed = Math.max(1, createTournamentFormData.ballSpeed - 1);
		showPongMenu();
	}
	else if (clickedBtn.action === 'paddleSpeedUp') {
		createTournamentFormData.paddleSpeed = Math.min(100, createTournamentFormData.paddleSpeed + 1);
		showPongMenu();
	}
	else if (clickedBtn.action === 'paddleSpeedDown') {
		createTournamentFormData.paddleSpeed = Math.max(1, createTournamentFormData.paddleSpeed - 1);
		showPongMenu();
	}
	else if (clickedBtn.action === 'backToMenu') {
		state.canvasViewState = 'mainMenu';
		showPongMenu();
	}
	else if (clickedBtn.action === 'createTournament') {
		const name = createTournamentFormData.tournamentName;
		if (!name) {
			showNotification({ message: 'Please enter a name first', type: 'error' });
			return;
		}

		apiFetch(`/api/tournament/${state.userId}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${state.authToken}`
			},
			body: JSON.stringify({
				name,
				maxPlayers: 16,
				status: 'open'
			})
		})
			.then(async resp => {
				showNotification({ message: `Tournament "${name}" created`, type: 'success' });
				let ownerName = `User${state.userId}`;
				try {
					const userResp = await apiFetch(`/api/user/by-index/${state.userId}`, {
						headers: { Authorization: `Bearer ${state.authToken}` }
					});
					ownerName = userResp.username.username;
				} catch {
					// if api breaks we keep userID
				}
				const list = await fetchOpenTournaments();
				state.availableTournaments = list;
				state.currentTournamentPlayers = [ ownerName ];
				const createdEntry = list.find(t => t.name === name)!;
				state.currentTournamentID      = createdEntry.tournamentID;
				state.currentTournamentName    = name;
				state.canvasViewState          = 'waitingTournament';

				localStorage.setItem('tournament_view', 'waitingTournament');
				localStorage.setItem('tournament_name', name);
				localStorage.setItem('tournament_id', String(state.currentTournamentID));
				localStorage.setItem('tournament_players', JSON.stringify([ownerName]));

				showPongMenu();
			})
			.catch(err => {
				console.error('Error creating tournament:', err);
				showNotification({ message: 'Failed to create', type: 'error' });
			});

		// Return here, because we don’t want to fall through and call showPongMenu() deux fois
		return;
	}
	else if (clickedBtn.action.startsWith('join:')) {
		const [, tourIDstr] = clickedBtn.action.split(':');
		const tourID = Number(tourIDstr);

		try {
			// Send POST /join to register to tournament
			await apiFetch(`/api/tournament/${tourID}/join/${state.userId}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${state.authToken}`
				},
				body: JSON.stringify({})
			});
		} catch (err) {
			console.error('Error joining tournament:', err);
			showNotification({ message: 'Failed to join tournament', type: 'error' });
			return;
		}

		// If successful, get members list by GET /members
		let members: { userID: number; alias: string }[] = [];
		try {
			const resp = await apiFetch(`/api/tournament/${tourID}/members`, {
				headers: { Authorization: `Bearer ${state.authToken}` }
			});
			members = resp.members;
		} catch (err) {
			console.error('Error fetching tournament members:', err);
			showNotification({ message: 'Cannot fetch tournament members', type: 'error' });
			return;
		}

		const usernames: string[] = [];
		for (const m of members) {
			if (m.alias && m.alias.trim() !== '') {
				usernames.push(m.alias);
			} else {
				try {
					const userResp = await apiFetch(`/api/user/by-index/${m.userID}`, {
						headers: { Authorization: `Bearer ${state.authToken}` }
					});
					usernames.push(userResp.username.username);
				} catch {
					usernames.push(`User${m.userID}`);
				}
			}
		}
		state.currentTournamentPlayers = usernames;
		// Update global state
		state.currentTournamentID      = tourID;
		state.currentTournamentName    = state.availableTournaments
			?.find(t => t.tournamentID === tourID)?.name || 'Unknown Tournament';
		state.canvasViewState          = 'waitingTournament';

		// store in localStorage to persist after refresh
		localStorage.setItem('tournament_view', 'waitingTournament');
		localStorage.setItem('tournament_id', String(tourID));
		localStorage.setItem('tournament_name', state.currentTournamentName);
		localStorage.setItem('tournament_players', JSON.stringify(usernames));

		showPongMenu();
	}
}


export async function handleWaitingTournamentClick(
	canvas: HTMLCanvasElement,
	x: number,
	y: number
): Promise<void> {
	const btns = (canvas as any)._waitingTournamentButtons as PongButton[] | undefined;
	if (!btns) return;

	const clickedBtn = btns.find((b: PongButton) =>
		x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
	);
	if (!clickedBtn) return;

	if (clickedBtn.action === 'leaveTournament') {
		// Call API to leave tournament
		const tournamentID = state.currentTournamentID;
		try {
			await apiFetch(`/api/tournament/${tournamentID}/leave/${state.userId}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${state.authToken}`
				},
				body: JSON.stringify({})
			});
		} catch (err) {
			console.error('Error leaving tournament:', err);
			showNotification({ message: 'Error leaving tournament', type: 'error' });
			return;
		}

		// Clean state & localStorage
		state.currentTournamentName    = undefined;
		state.currentTournamentPlayers = undefined;
		state.currentTournamentID      = undefined;
		delete state.currentTournamentID;

		localStorage.removeItem('tournament_view');
		localStorage.removeItem('tournament_name');
		localStorage.removeItem('tournament_players');
		localStorage.removeItem('tournament_id');

		state.canvasViewState = 'mainMenu';
		showPongMenu();
	}
}