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
  paddleSpeed: 50,
  limit:60
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
    await handleLeaveTournament();
    showPongMenu();
  }
  // Start tournament when creator clicks the button
  else if (clickedBtn.action === 'startTournament') {
    // await startTournament();
    showNotification({message:`Tournament Starting now !`, type:'success'});
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
        status: 'waiting',
        paddleSpeed: createTournamentFormData.paddleSpeed,
        ballSpeed: createTournamentFormData.ballSpeed,
        limit: createTournamentFormData.limit
      })
    });
    showNotification({ message: `Tournament "${name}" created`, type: 'success' });
	
	//send joinTournament request to backend 
	state.playerInterface!.typedSocket.send('joinTournament', {userID:state.userId, tournamentID:reply.tournament.tournamentID});
  
  // notify that this user is the tournament's creator
  state.isTournamentCreator = true;

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
  
  state.isTournamentCreator = false;
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
  state.isTournamentCreator = false;
  delete state.currentTournamentID;

  localStorage.removeItem('tournament_view');
  localStorage.removeItem('tournament_name');
  localStorage.removeItem('tournament_players');
  localStorage.removeItem('tournament_id');

  state.canvasViewState = 'mainMenu';
  showPongMenu();
}