import { isAuthenticated, apiFetch, state } from './api';
import { drawCreateGameView, 
    drawWaitingGameView,
    drawJoinGameView,
    drawTournamentView,
    drawWaitingTournamentView } from './pong_views';
import { showNotification } from './notifications';
import { pongState } from './pong_socket';
import { PongRenderer } from './pong_render'
import { TypedSocket } from './shared/gameTypes';
import { resizePongCanvas } from './handlers';
import { PongButton, showPongMenu } from './pong_rooms';

export const createTournamentFormData = {
  tournamentName: null as string | null,
  ballSpeed: 50,
  paddleSpeed: 50
};

export async function fetchOpenTournaments(): Promise<{ tournamentID: number; name: string }[]> {
  const resp = await apiFetch('/api/tournament/list', {
    headers: { Authorization: `Bearer ${state.authToken}` }
  });
  return resp.tournaments;
}

// Handle clicks in the Tournament view
export async function handleTournamentClick(canvas: HTMLCanvasElement, x: number, y: number): Promise<void> {
	const btns = (canvas as any)._tournamentButtons as PongButton[] | undefined;
	if (!btns) return;

	const clickedBtn = btns.find(b =>
		x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
	);
	if (!clickedBtn) return;

	switch (clickedBtn.action) {
		case 'editTournamentName':
			showNotification({ message: 'Enter tournament name:', type: 'prompt', placeholder: 'Tournament Name', onConfirm: val => { createTournamentFormData.tournamentName = val ?? null; showPongMenu(); } });
			break;

		case 'ballSpeedUp':
			createTournamentFormData.ballSpeed = Math.min(100, createTournamentFormData.ballSpeed + 1);
			showPongMenu();
			break;

		case 'ballSpeedDown':
			createTournamentFormData.ballSpeed = Math.max(1, createTournamentFormData.ballSpeed - 1);
			showPongMenu();
			break;

		case 'paddleSpeedUp':
			createTournamentFormData.paddleSpeed = Math.min(100, createTournamentFormData.paddleSpeed + 1);
			showPongMenu();
			break;

		case 'paddleSpeedDown':
			createTournamentFormData.paddleSpeed = Math.max(1, createTournamentFormData.paddleSpeed - 1);
			showPongMenu();
			break;

		case 'backToMenu':
			state.canvasViewState = 'mainMenu';
			showPongMenu();
			break;

		case 'createTournament':
			// showNotification & API call handled inline
			await handleCreateTournament();
			break;

		default:
      if (clickedBtn.action.startsWith('join:')) {
        const tourID = Number(clickedBtn.action.split(':')[1]);
        await handleJoinTournament(tourID);
      }
			else if (clickedBtn.action === 'leaveTournament') {
				return handleLeaveTournament();
			}
      break;
	}
}

// Handle clicks in the Waiting Tournament view
export async function handleWaitingTournamentClick(canvas: HTMLCanvasElement, x: number, y: number): Promise<void> {
	const btns = (canvas as any)._waitingTournamentButtons as PongButton[] | undefined;
	if (!btns) return;

	const clickedBtn = btns.find((b: PongButton) =>
		x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
	);
	if (!clickedBtn) return;

	if (clickedBtn.action === 'leaveTournament') {
		await handleLeaveTournament();
		showPongMenu();
	}
}

export async function handleCreateTournament(): Promise<void> {
  const name = createTournamentFormData.tournamentName;
  if(state.playerInterface!.state !== 'init'){
	showNotification({message:`You can't create tournament because you are ${state.playerInterface!.state}`, type:'error'})
	return;
  }
  if (!name) {
    showNotification({ message: 'Please enter a name first', type: 'error' });
    return;
  }

  try {
    // POST to create tournament
   const reply =  await apiFetch(`/api/tournament/${state.userId}`, {
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
    });
    showNotification({ message: `Tournament "${name}" created`, type: 'success' });
	
	//send joinTournament request to backend 
	state.playerInterface!.typedSocket.send('joinTournament', {userID:state.userId, tournamentID:reply.tournament.tournamentID});
    
	//ALL BELOW NEEDS TO MOVE TO UPDATELIST SOCKET 
	// fetch owner username
    // let ownerName = `User${state.userId}`;
    // try {
    //   const userResp = await apiFetch(`/api/user/by-index/${state.userId}`, {
    //     headers: { Authorization: `Bearer ${state.authToken}` }
    //   });
    //   ownerName = userResp.username.username;
    // } catch { /* keep numeric ID if fetch fails */ }

    // // refresh list and update state
    // state.availableTournaments = await fetchOpenTournaments();
    // state.currentTournamentPlayers = [ownerName];
    // const created = state.availableTournaments.find(t => t.name === name)!;
    // state.currentTournamentID   = created.tournamentID;
    // state.currentTournamentName = name;
    // state.canvasViewState       = 'waitingTournament';

    // // persist to localStorage
    // localStorage.setItem('tournament_view', 'waitingTournament');
    // localStorage.setItem('tournament_name', name);
    // localStorage.setItem('tournament_id', String(state.currentTournamentID));
    // localStorage.setItem('tournament_players', JSON.stringify([ownerName]));
    // showPongMenu();

  } catch (err) {
    console.error('Error creating tournament:', err);
    showNotification({ message: 'Failed to create', type: 'error' });
  }
}

// Handles the "Join Tournament" button action
export async function handleJoinTournament(tourID: number): Promise<void> {
    
	if(state.playerInterface!.state !== 'init'){
		showNotification({message:`You can't join tournament because you are ${state.playerInterface!.state}`, type:'error'})
		return;
	}
	state.playerInterface!.typedSocket.send('joinTournament',  {userID:state.userId, tournamentID:tourID})


	//ALL BELOW NEEDS TO MOVE TO UPDATELIST SOCKET
  // fetch members list
//   let members: { userID: number; alias: string }[] = [];
//   try {
//     const resp = await apiFetch(`/api/tournament/${tourID}/members`, {
//       headers: { Authorization: `Bearer ${state.authToken}` }
//     });
//     members = resp.members;
//   } catch (err) {
//     console.error('Error fetching tournament members:', err);
//     showNotification({ message: 'Cannot fetch tournament members', type: 'error' });
//     return;
//   }

//   // resolve usernames
//   const usernames: string[] = [];
//   for (const m of members) {
//     if (m.alias?.trim()) {
//       usernames.push(m.alias);
//     } else {
//       try {
//         const userResp = await apiFetch(`/api/user/by-index/${m.userID}`, {
//           headers: { Authorization: `Bearer ${state.authToken}` }
//         });
//         usernames.push(userResp.username.username);
//       } catch {
//         usernames.push(`User${m.userID}`);
//       }
//     }
//   }

//   // update state and persist
//   state.currentTournamentPlayers = usernames;
//   state.currentTournamentID      = tourID;
//   state.currentTournamentName    =
//     state.availableTournaments?.find(t => t.tournamentID === tourID)?.name
//     ?? 'Unknown Tournament';
//   state.canvasViewState          = 'waitingTournament';

//   localStorage.setItem('tournament_view', 'waitingTournament');
//   localStorage.setItem('tournament_id', String(tourID));
//   localStorage.setItem('tournament_name', state.currentTournamentName);
//   localStorage.setItem('tournament_players', JSON.stringify(usernames));
  //showPongMenu();
}

// Handles the "Leave Tournament" button action
export async function handleLeaveTournament(): Promise<void> {
  const tourID = state.currentTournamentID!;
  state.playerInterface!.typedSocket.send('leaveTournament', {
	userID:state.playerInterface!.userID,
	tournamentID:tourID,
	islegit:false
  });

  // clean up state & storage
  state.currentTournamentName    = undefined;
  state.currentTournamentPlayers = undefined;
  delete state.currentTournamentID;

  localStorage.removeItem('tournament_view');
  localStorage.removeItem('tournament_name');
  localStorage.removeItem('tournament_players');
  localStorage.removeItem('tournament_id');

  state.canvasViewState = 'mainMenu';
  showPongMenu();
}