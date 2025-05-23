
import {WebSocket} from 'wss';
import {state} from './api.js'

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
						//User in now register for game socket and is able to start
					}
					break;
				}
				case'create':{
					if(data.success === false)
						console.log('Unable to create room');
					//should be print on game screen ? 
					else 
						console.log('Game created with succes');
					break;
				}
				case 'joinGame':{
					if(data.success === false)
						console.log('Unable to join GameRoom');
					else 
						console.log('GameRoom joined with succes');
					break;
				}
				case 'invite':{
					handleInvite(state, data);
					break;
				}
				case 'endMatch':{
					break;
				}
				case 'playerMoove':{
					break;
				}
				case 'render':{
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

export async function handleInvite(state, data){

	if(data.action === 'reply'){
		if(data.response !== 'accept')
			console.log(`The user you tried to invite is ${data.response}`);
		else 
			console.log('The user you invited just joined the GameRoom');
	}
	if(data.action == 'receive'){
		console.log(`${data.fromAlias} invted you to join his gameRoom ${data.gameID}`);
		//send form/notif to get 
		// response = getResponseFromUser();
		// alias = getAliasFromUser(); 
		state.gameSocket.send(JSON.stringify({}));
	}

}