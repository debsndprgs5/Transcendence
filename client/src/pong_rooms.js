import * as GameSockets from './pong_socket.js'
import {apiFetch, state} from './api.js'

// =======================
// PONG MENU
// =======================
export function showPongMenu() {
	const canvas = document.getElementById('pong-canvas');
	const ctx = canvas.getContext('2d');
	drawPongMenu(canvas, ctx);

	canvas.onclick = handlePongMenuClick;
}


export function drawPongMenu(canvas, ctx) {
	const width = canvas.width;
	const height = canvas.height;

	ctx.clearRect(0, 0, width, height);

	// Title
	ctx.fillStyle = "#6366f1";
	ctx.font = `${Math.floor(height/10)}px Arial`;
	ctx.textAlign = "center";
	ctx.fillText("Transcendence Pong", width/2, height/5);

	// Buttons
	const btns = [
		{ label: "Create Game",   y: height/2 - 60 },
		{ label: "Join Game",     y: height/2 },
		{ label: "Tournament",    y: height/2 + 60 },
		{ label: "Settings",      y: height/2 + 120 }
	];
	ctx.font = `${Math.floor(height/18)}px Arial`;
	ctx.textAlign = "center";

	btns.forEach(btn => {
		ctx.fillStyle = "#22d3ee";
		ctx.fillRect(width/2 - 110, btn.y - 30, 220, 50);
		ctx.fillStyle = "black";
		ctx.fillText(btn.label, width/2, btn.y);
	});

	// Save btn pos to handle clicks
	canvas._pongMenuBtns = btns.map((btn, i) => ({
		x: width/2 - 110, y: btn.y - 30, w: 220, h: 50, action: btn.label
	}));
}

// Handling click on the game canvas
 async function handlePongMenuClick(e) {
	const canvas = document.getElementById('pong-canvas');
	const rect = canvas.getBoundingClientRect();
	const x = (e.clientX - rect.left) * (canvas.width / rect.width);
	const y = (e.clientY - rect.top) * (canvas.height / rect.height);

	if (!canvas._pongMenuBtns) return;
	const btn = canvas._pongMenuBtns.find(b =>
		x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
	);
	if (btn) {
		alert(`Clicked: ${btn.action}`);
		// if btn.action === "Create Game" -> next steps
		switch(btn.action){
			case 'Create Game': {
				createGameButton();
				break;
			}
			case 'Join Game' : {
				const list = await getPublicGameList();
				//show list and wait for user to click 
				joinGameButton();
				break;
			}
			// case 'Tournament' : {
			// 	break;
			// }
			// case 'Settings' : {
			// 	break;
			// }
		}
	}
}

export async function  createGameButton(){
	//Incrust gameSettings form here ? for now They are all the same 
	//post(/games/pong/create)
	//gameID and data in body 
}

export async function joinGameButton(){
	//const roomID = getJoinForm?
	//can we wait for reply here ? or is this somewhere else in the back 
	state.gameSocket.send(JSON.stringify({
		type: 'joinGame',
		roomID:roomID
	}));
	//if success -> ask back to start game
	//if back says game can start-> render game 
	//if back says game can't start ->  render waiting for opponents  
}

export async function getPublicGameList(){
	apiFetch(get, '/pong/list');
	//extract list from body 
	//returns a parsed list easy to print 
}

// export async function tournamentButton(){
// }

// export async function settingsButton(){
// }