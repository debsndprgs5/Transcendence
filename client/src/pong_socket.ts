

import {apiFetch, AppState, state} from './api.js'
import { showNotification, showUserActionsBubble } from './notifications.js';
//export async function gameSystemLog(msg)
//export async function gameEndsLog(msg)


export async function initGameSocket(){
	console.log('INIT GAME SOCKET CALL ');
	if(!state.authToken)
		return;
	const wsUrl = `wss://${location.host}/gameSocket/ws?token=${encodeURIComponent(state.authToken)}`;
	const gameSocket = new WebSocket(wsUrl);

	gameSocket.onopen = () => {
		console.log('OPENNING GAME SOCKET');
		gameSocket.send(JSON.stringify({
			type: 'init',
			userID:state.userId
		}));
	};

	gameSocket.onmessage = (event) =>{
		try{
			const data = JSON.parse(event.data);
			switch (data.type){
				case 'init':{
					if(data.success === 'true'){
						state.gameSocket=gameSocket;
						state.userId=data.userID;
						state.playerState= data.state;
						showNotification({ message: 'connection with game established', type: 'success' });
						//User in now register for game socket and is able to start
					}
					break;
				}
				case 'joinGame':{
					if(data.success === false)
						showNotification({ message:'Unable to join game' , type: 'error' });
					else 
						showNotification({ message:'Game joined with success' , type: 'success' });
					break;
				}
				case 'invite':{
					handleInvite(state, data);
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
				case 'endMatch':{
					handleEndMatch(state, data);
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
			}
		}
		catch(err){
			console.error('Failed to handle GameSocket message:', err);
		}
	};

	gameSocket.onclose = (event) =>{
	
	};

	gameSocket.onerror = (error) => {
		console.error('WebSocket error:', error);
	};
}


export async function handleEndMatch(state:AppState, data:string){
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

export async function handleInvite(state:AppState, data:string){
	const {action , response, userID} = JSON.parse(data);
	if(action === 'reply'){
		if(response !== 'accept')
			console.log(`The user you tried to invite is ${response}`);
		else 
			console.log('The user you invited just joined the GameRoom');
	}
	if(action == 'receive'){

		const username = apiFetch(`user/by-index/${userID}`)
			showNotification({
						message: `${username} invited you to play, join ?`,
						type: 'confirm',
						onConfirm: async () => {
							const response = 'accept'
							if(state.gameSocket){
								state.gameSocket.send(JSON.stringify({
									type:'invite',
									action: 'reply',
									response
								}));
							}
						},
						onCancel:async() => {
							const response = 'decline'
							if(state.gameSocket){
								state.gameSocket.send(JSON.stringify({
									type:'invite',
									action: 'reply',
									response
								}));
							}
						}

			});
	}
}