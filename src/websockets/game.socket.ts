
const MappedPlayers= new Map<number, WebSocket>();

export function initGameSocket(){
	//Init socket for a client
	//Adds it to MappedPlayers
	//Wait for another socket to connect
}

export function handleGameConnect(){
	//once 2 players are found , create a game room if none is given for arg 
}

export function startGame(){
}

export function gameLoop(){
}

export function handleMovement(){
}

export function sendData(){
}


/*
		front send Invite(A invite B) > back check if B can play > if so send invite B > wait for B reply > send back to front B reply to A
	type "Invite"
	action 'send' | 'reply'
	userID: A
	targetID: B 
	response: 'accept'|'decline'| 'impossible'-> not conected or playing

		front send A give this up -> back check what to do > reply to others sockets affected (End Match/start next TournamentTurn ...)
	type "Giveup"
	mode: 'game'| 'tournament'
	gameID:
	TournamentID?:
	userID:

			front send usrID and willing mode > back adds to playerSocket > Match found > reply to front ready with roomID
	type "Waiting"
	action 'waiting' | 'ready'
	mode:
	userID:
	gameID?:

		front send data -> back update db > send winner -> front render win or lose 
	type "End match"
	mode:
	gameID:
	winner:yes|no
	data {JSON {for stats later}}
			
		front ask render > back gives back data to render / if render tournament we show all current and comming brackets/matches and byes
		here front could send JSON data for stats an update db every tick ? 
	type: "Render"
	mode:
	userID:
	gameID:
	data:{user_pos: , oponnent_pos: , ball_px: , ball_py: , ball_vel: , ball_angle ...}
		
		front tell back player move 
	type: "PlayerMoove"
	action: 'up'|'down'
	intensity?
	roomID:
	userID or alias 


*/