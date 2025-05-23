
import {WebSocket} from 'wss';
import {apiFetch, state} from './api.js'
import { showNotification, showUserActionsBubble } from './notifications.js';
//export async function gameSystemLog(msg)
//export async function gameEndsLog(msg)


export async function initGameSocket(){

	const wsUrl = `wss://${location.host}/ws?token=${encodeURIComponent(state.authToken)}`;
	const gameSocket = new WebSocket(wsUrl);
	gameSocket.onopen = () => {
		//do nothing back handle it 
	};

	gameSocket.onmessage = (event) =>{
		try{
			data = JSON.parse(event.data);
			switch (data.type){
				case 'init':{
					if(data.success){
						state.gameSocket=gameSocket;
						state.userId=data.userID;
						state.playerState= data.state;
						showNotification({ message: 'connection with game established', type: 'success' });
						//User in now register for game socket and is able to start
					}
					break;
				}
				case'create':{
					if(data.success === false)
						showNotification({ message:'Unable to create game' , type: 'error' });
					else 
						showNotification({ message:'Game created with succes' , type: 'success' });
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
					state.socket.send(JSON.stringify({
						type:'render',
						action: 'beginGame',
						gameID:data.gameID,
						data:null
					}));
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
		catch{
			console.error('Failed to handle GameSocket message:', err);
		}
	};

	gameSocket.onclose = (event) =>{
	
	};

	gameSocket.onerror = (error) => {
		console.error('WebSocket error:', error);
	};
}


export async function handleEndMatch(state, data){
	if(data.action === 'legit'){
	//KICK both player from room , removes them and the room from db
	//update games stats/ history
	}
	if(data.action === 'playerGaveUp'){
	//give the win to the other, removes other from game and both from db 
	//don't update stats 
	}
	if(data.action == 'oppponentGaveUp'){
	//give the win to player, removes him from game both from db 
	//don't update stats 
	}
}

export async function handleInvite(state, data){

	if(data.action === 'reply'){
		if(data.response !== 'accept')
			console.log(`The user you tried to invite is ${data.response}`);
		else 
			console.log('The user you invited just joined the GameRoom');
	}
	if(data.action == 'receive'){

		const username = apiFetch(`user/by-index/${data.userID}`)
		const response = null;
			showNotification({
						message: `${username} invited you to play, join ?`,
						type: 'confirm',
						onConfirm: async () => {
							response = 'accept'
							state.gameSocket.send(JSON.stringify({
								type:'invite',
								action: 'reply',
								response
						}));
						},
						onCancel:async() => {
							response = 'decline'
							state.gameSocket.send(JSON.stringify({
								type:'invite',
								action: 'reply',
								response
						}));
						}

			});
	}
}