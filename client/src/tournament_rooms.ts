import { isAuthenticated, apiFetch, state } from './api';
import { drawCreateGameView, 
    drawWaitingGameView,
    drawJoinGameView,
    drawTournamentView,
    drawWaitingTournamentView } from './pong_views';
import { showNotification } from './notifications';
import { pongState } from './pong_socket';
import { PongRenderer } from './render/NEW_pong_render'
import { TypedSocket } from './shared/gameTypes';
import { resizePongCanvas } from './handlers';
import { PongButton, showPongMenu } from './pong_rooms';
import { addMemberToRoom, loadRooms, selectRoom, rmMemberFromRoom } from './handlers';

export const createTournamentFormData = {
  tournamentName: null as string | null,
  ballSpeed: 50,
  paddleSpeed: 50,
  limit:20
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
				return handleLeaveTournament(false);
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
     handleLeaveTournament(false);
  }
  // Start tournament when creator clicks the button
  else if (clickedBtn.action === 'startTournament') {
    showNotification({message:`Tournament Starting now !`, type:'success'});
    state.playerInterface!.typedSocket.send('startTournament', {userID:state.userId, tournamentID:state.playerInterface!.tournamentID})
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
    //Create and Join chatRoom of tournament
      const newRoom = await apiFetch<{ roomID: number }>('/api/chat/rooms', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${state.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: `Tournament: ${name}` , isTourLink:true})
      });
      await addMemberToRoom(newRoom.roomID, state.userId!);
      selectRoom(newRoom.roomID);
      await loadRooms();
          state.socket?.send(JSON.stringify({
      type:'systemMessage',
      chatRoomID:newRoom.roomID,
      content: `${localStorage.getItem('username')} just created tournament !`//PUT alias here
    }));
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
        limit: createTournamentFormData.limit,
        chatID:newRoom.roomID
      })
    });
    showNotification({ message: `Tournament "${name}" created`, type: 'success' });
	  state.playerInterface!.isTourOwner = true;
	//send joinTournament request to backend 
	state.playerInterface!.typedSocket.send('joinTournament', {
    userID:state.userId,
    tournamentID:reply.tournament.tournamentID,
    chatID:newRoom.roomID,
    isTourOwner:state.playerInterface!.isTourOwner,
     alias:`alias of ${state.playerInterface!.username}`//PUT user Alias Promt Here
  });
  
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
  if(state.playerInterface!.isTourOwner !== true)
    state.playerInterface!.isTourOwner = false;
	state.playerInterface!.typedSocket.send('joinTournament',  {
    userID:state.userId,
    tournamentID:tourID,
    isTourOwner:state.playerInterface!.isTourOwner,
      alias:`alias of ${state.playerInterface!.username}`//PUT alias inpput here
  });
  //join linked chatRoom
  const { chatID } = await apiFetch(`/api/tournaments/chat/${tourID}`);
  await addMemberToRoom(chatID, state.userId!);
  selectRoom(chatID.ID);
  await loadRooms();
  state.socket?.send(JSON.stringify({
    type:'systemMessage',
    chatRoomID:chatID,
    content: `${localStorage.getItem('username')} just join tournament !`
  }));


}

// Handles the "Leave Tournament" button action
export async function handleLeaveTournament(islegit:boolean, duringGame?:boolean|undefined): Promise<void> {
  if(islegit === true)
    console.warn(`[TOURNAMENT][EXIT CLICKED]`);
  if(duringGame === undefined)
    duringGame = false;
  const tourID = state.playerInterface!.tournamentID!;
  const { chatID } = await apiFetch(`/api/tournaments/chat/${tourID}`);
    state.socket?.send(JSON.stringify({
    type:'systemMessage',
    chatRoomID:chatID,
    content: `${localStorage.getItem('username')} just left tournament !`
  }));
  await rmMemberFromRoom(chatID, state.userId!);
  //selectRoom(0);
  state.playerInterface!.typedSocket.send('leaveTournament', {
    userID:state.playerInterface!.userID,
    tournamentID:tourID,
    islegit:islegit,
    duringGame:duringGame,
    isTourOwner:state.playerInterface?.isTourOwner
  });

  // clean up state & storage
  state.currentTournamentName    = undefined;
  state.currentTournamentPlayers = undefined;
  state.playerInterface!.isTourOwner = false;
  state.playerInterface!.tournamentID = undefined;
  localStorage.removeItem('tournament_view');
  localStorage.removeItem('tournament_name');
  localStorage.removeItem('tournament_players');
  localStorage.removeItem('tournament_id');
  
  state.canvasViewState = 'mainMenu';
  showPongMenu();
}


export function isLastTournamentRound(gameName: string): boolean {
	const match = gameName.match(/Round (\d+)\/(\d+)/);
	if (!match) return false;

	const current = parseInt(match[1], 10);
	const max = parseInt(match[2], 10);

	return current === max;
}


export function handleTournamentRoundsClick(
  canvas: HTMLCanvasElement,
  x: number,
  y: number
): void {
  const rect = canvas.getBoundingClientRect();

  const buttons = (canvas as any)._waitingTournamentButtons as {
    x: number; y: number; w: number; h: number; action: string;
  }[] | undefined;
  if (!buttons) return;
  let isReady=false;
  for (const btn of buttons) {
    if (
      x >= btn.x &&
      x <= btn.x + btn.w &&
      y >= btn.y &&
      y <= btn.y + btn.h
    ) {
      switch (btn.action) {
        case 'leaveTournament':
          const isLastRound = isLastTournamentRound(localStorage.getItem(`gameName`)!);
          handleLeaveTournament(isLastRound);
          break;
        case 'ready':
          if(isReady === false){
            state.playerInterface!.typedSocket.send('readyNextRound', {
              tourID:state.playerInterface!.tournamentID,
              userID:state.userId!
            });
            isReady = true;
          }
          break;
        case 'exitTournament':
            handleLeaveTournament(true);
            break;
      }
      break;
    }
  }
}