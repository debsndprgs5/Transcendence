
import { showNotification, showUserActionsBubble } from './notifications.js';
//export async function gameSystemLog(msg)
//export async function gameEndsLog(msg)
import { isAuthenticated, apiFetch, initWebSocket, state } from './api';
import { showPongMenu } from './pong_rooms';


export async function initGameSocket(){
	console.log('INIT GAME SOCKET CALL ');
	
	if(!state.authToken)
		return;
	const wsUrl = `wss://${location.host}/gameSocket/ws?token=${encodeURIComponent(state.authToken)}`;
	const gameSocket = new WebSocket(wsUrl);
	state.gameSocket=gameSocket;

	await new Promise<void>((resolve, reject) => {
		gameSocket.onopen = () => {
			console.log('OPENING GAME SOCKET');
			if(state.playerState === 'online' || !state.playerState)
				state.playerState = 'init';
			resolve(); // Wait ends here
		};
		gameSocket.onclose = () =>{
			//Set time out to 15sec just like in back ? 
			//Keep OldState from state.playerSte in memory 

		}
		gameSocket.onerror = (err) => {
			console.error('[GAME]WebSocket error:', err);
			reject(err);
		};
	});

	gameSocket.onmessage = (event) =>{
		try{
			const data = JSON.parse(event.data);
			switch (data.type){
				case 'init':{
					if(data.success === 'true'){
						state.gameSocket=gameSocket;
						state.userId=data.userID;
						state.playerState= 'init';
						showNotification({ message: `connection with game established\n${data.state}`, type: 'success' });
						//User in now register for game socket and is able to start
					}
					break;
				}
				case 'joinGame':{
					if(data.success === false)
						showNotification({ message:`Unable to join game because ${data.reason}` , type: 'error' });
					else 
						showNotification({ message:`Game joined with success${data.gameID}` , type: 'success' });
					break;
				}
				case 'invite':{
					handleInvite(data);
					break;
				}
				case 'startGame':{
					if(state.gameSocket){
						state.gameSocket.send(JSON.stringify({
							type:'render',
							action: 'beginGame',
							gameID:data.gameID,
							data:null
						}));
					}
					else 
						console.log(`[FRONT][GAMESOCKET] : [No socket for startGame][${state}]`);
					break;
				}
				case 'statusUpdate':{
					console.log(`[FRONT][GAMESOCKET][oldSTATUS]${state.playerState}||[newSTATUS]${state.playerState}`);
					if(data.newState){
						state.playerState = data.newState;
					}
					break;
				}
				case 'endMatch':{
					handleEndMatch(data);
					break;
				}
				case 'playerMoove':{
					//does front should received this on top of render ? 
					//Update oppononent mouvement 
					break;
				}
				case 'render':{
					//Receive all data for game render 
					break;
				}
				case'reconnected':{
					console.log(`[FRONT][GAMESOCKET]user ${state.userId}: just reconneted`);
					//What logic should we have for reconnected? 
					state.playerState=data.state;
					if(data.gameID && (state.playerState === 'waiting' || state.playerState === 'online')){
						//Returns to renderGame?
						//PACEHODLER TO EXIT ROOM
						showNotification({
						message:'Do you want to leave room ?',
						type:'confirm',
						onConfirm: () => {
							state.gameSocket?.send(JSON.stringify({
								type:'leaveGame',
								userID:state.userId,
								gameID:data.gameID
							}));
						}});
					}
					break;
				}
			}
		}
		catch(err){
			console.error('Failed to handle GameSocket message:', err);
		}
	};

	gameSocket.onclose = (event) =>{
		console.log(`${state.userId} got offline`);
		state.playerState = 'offline';
	};

	gameSocket.onerror = (error) => {
		console.error('[GAME]WebSocket error:', error);
	};
}


export async function handleEndMatch(data:string){
	// if(data.action === 'legit'){
	// //KICK both player from room , removes them and the room from db
	// //update games stats/ history
	// }
	// if(data.action === 'playerGaveUp'){
	// //give the win to the other, removes other from game and both from db 
	// //don't update stats 
	// }
	// if(data.action == 'oppponentGaveUp'){
	// //give the win to player, removes him from game both from db 
	// //don't update stats 
	// }
}

export async function handleInvite(raw: string) {
  const data = JSON.parse(raw);

  // Invite received
  if (data.type === 'invite' && data.action === 'send') {
    const { fromUsername, fromUserID, gameID, gameName } = data;
    showNotification({
      message: `${fromUsername} vous invite à "${gameName}". Accepter ?`,
      type: 'confirm',
      onConfirm: async () => {
        // User accepted -> send response to server
        if (state.gameSocket) {
          state.gameSocket.send(JSON.stringify({
            type: 'invite',
            action: 'reply',
            response: 'accept',
            toUserID: fromUserID,     // send back to sender
            gameID
          }));
        }
        // send socket to join the game
        if (state.gameSocket) {
          state.gameSocket.send(JSON.stringify({
            type: 'joinGame',
            userID: state.userId,
            gameID
          }));
        }
        // init waiting game
        state.currentGameName = gameName;
        state.currentPlayers = [ state.username ];
        state.canvasViewState = 'waitingGame';
        localStorage.setItem('pong_view', 'waitingGame');
        localStorage.setItem('pong_room', gameName);
        localStorage.setItem('pong_players', JSON.stringify([ state.username ]));
        showPongMenu();
      },
      onCancel: async () => {
        // User declined -> send response to server
        if (state.gameSocket) {
          state.gameSocket.send(JSON.stringify({
            type: 'invite',
            action: 'reply',
            response: 'decline',
            toUserID: fromUserID,
            gameID
          }));
        }
      }
    });

  // Handle response for the one who sent the invite
  } else if (data.type === 'invite' && data.action === 'reply') {
    const { response, toUserID, gameID } = data;
    // Only the one who invited has to handle this, so
    if (toUserID !== state.userId) {
      return; // we return if not the right user
    }
    if (response === 'accept') {
      // invited user accepted
      if (state.gameSocket) {
        state.gameSocket.send(JSON.stringify({
          type: 'joinGame',
          userID: state.userId,
          gameID
        }));
      }
      // Go aswell on waiting game
      const name = state.currentGameName ?? 'Private Room';
      state.currentGameName = name;
      state.currentPlayers = [ state.username ];
      state.canvasViewState = 'waitingGame';
      localStorage.setItem('pong_view', 'waitingGame');
      localStorage.setItem('pong_room', name);
      localStorage.setItem('pong_players', JSON.stringify([ state.username ]));
      showNotification({ message: 'Invitation accepted. Starting the game.', type: 'success' });
      showPongMenu();

    } else {
      // Invited one has refused
      showNotification({ message: 'Invitation declined.', type: 'info' });
    }
  }
}