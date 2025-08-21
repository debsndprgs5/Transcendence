import * as Interfaces from './shared/gameTypes';
import {createTypedEventSocket} from './shared/gameEventWrapper';
import { apiFetch, state } from './api';
import { showPongMenu } from './pong_rooms';
import { TypedSocket } from './shared/gameTypes';
import { showNotification, showUserActionsBubble } from './notifications';
import { fetchOpenTournaments } from './tournament_rooms'


export function handleJoinTournament(data: Interfaces.SocketMessageMap['joinTournament']) {
	if (!data.success) {
		showNotification({ message: `Unable to join tournament "${data.tourName}"`, type: 'error' });
		return;
	}
	showNotification({ message: `Joined tournament "${data.tourName}" successfully`, type: 'success' });
	state.playerInterface!.tournamentID = data.tournamentID;
	state.currentTournamentName = data.tourName;
	state.canvasViewState       = 'waitingTournament';

	if (!state.currentTournamentPlayers) {
		state.currentTournamentPlayers = [];
	}

	if (!state.currentTournamentPlayers.some(p => p.username === data.username!)) {
		state.currentTournamentPlayers.push({
			username: data.alias!,
			score: 0
		});
	}

	localStorage.setItem('tournament_view', 'waitingTournament');
	localStorage.setItem('tournament_name', data.tourName);
	localStorage.setItem('tournament_id', String(data.tournamentID));
	localStorage.setItem(
		'tournament_players',
		JSON.stringify(state.currentTournamentPlayers)
	);

	showPongMenu();
}

export function handleUpdateTournamentPlayerList(
	data: Interfaces.SocketMessageMap['updateTourPlayerList']
) {
	if (!state.playerInterface!.tournamentID || data.tournamentID !== state.playerInterface!.tournamentID) {
		return;
	}

	state.currentTournamentPlayers = data.members.map(m => ({
		username: m.username,
		score: 0
	}));

	localStorage.setItem(
		'tournament_players',
		JSON.stringify(state.currentTournamentPlayers)
	);

	showPongMenu();
}

export function handleUpdateTournamentList(data: Interfaces.SocketMessageMap['updateTourList']) {
	
	const parsedList = data.list.map(t => ({
		tournamentID: t.tourID,
		name: t.name
	}));

	state.availableTournaments = parsedList;

	localStorage.setItem('tournament_list', JSON.stringify(parsedList));
	showPongMenu();
}

export function handleStartTournament(data:Interfaces.SocketMessageMap['startTournament']){
	showNotification({message:'Tournament is about to start', type:'success'});
}

//data.score=stringJSON{username{score: , rank|pos: } username{} ...}
export function handleEndTournament(data:Interfaces.SocketMessageMap['endTournament']){
	
	state.currentTournamentPlayers = data.standings;
	state.currentTournamentName = data.tourName;
	state.canvasViewState = 'endTournament';
	showPongMenu();
}


export function handleStartNextRound(data:Interfaces.SocketMessageMap['startNextRound']){
	console.warn('[TOUR][STARTNEXTROUND]gamename =', data.gameName);
	state.currentGameName = data.gameName;
	state.canvasViewState = 'waitingTournamentRounds';
	state.typedSocket.send('joinGame', {userID:state.userId, gameID:data.gameID, gameName:data.gameName});
}

export function handleUpdateTourScore(data:Interfaces.SocketMessageMap['updateTourScore']){
		state.currentTournamentPlayers = data.score;
		state.canvasViewState = 'waitingTournamentRounds';
		showPongMenu();
}

export function handleAlias(data:Interfaces.SocketMessageMap['aliasCheck']){

	if(data.response === 'failure'){
		showNotification({
				message: 'NAME is being used , please choose a New one',
				type: 'prompt',
				placeholder: 'XxX_D4RK_K1LL3R_XxX',
				onConfirm: val => {
					state.typedSocket.send('aliasCheck', {action: 'Post', alias: val});
				},
				onCancel:() => {
					showNotification({
						message: 'You have to type an alias if you want to participate in a tournament.',
						type: 'error',
					});
					state.canvasViewState = 'mainMenu';
					showPongMenu();
				}
			});
	}
	else {
		state.canvasViewState = 'tournament';
		state.alias = data.alias!;
		fetchOpenTournaments()
		showPongMenu();
	}
		//return to tournament logic here ? 
}