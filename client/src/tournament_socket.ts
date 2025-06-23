import * as Interfaces from './shared/gameTypes';
import {createTypedEventSocket} from './shared/gameEventWrapper';
import { apiFetch, state } from './api';
import { showPongMenu } from './pong_rooms';
import { TypedSocket } from './shared/gameTypes';
import { showNotification, showUserActionsBubble } from './notifications';


export function handleJoinTournament(data: Interfaces.SocketMessageMap['joinTournament']) {
	if (!data.success) {
		showNotification({ message: `Unable to join tournament "${data.tourName}"`, type: 'error' });
		return;
	}

	showNotification({ message: `Joined tournament "${data.tourName}" successfully`, type: 'success' });

	state.currentTournamentID = data.tournamentID;
	state.currentTournamentName = data.tourName;
	state.canvasViewState = 'waitingTournament';

	if (!state.currentTournamentPlayers)
		state.currentTournamentPlayers = [];

	if (!state.currentTournamentPlayers!.includes(data.username!))
		state.currentTournamentPlayers.push(data.username!);

	localStorage.setItem('tournament_view', 'waitingTournament');
	localStorage.setItem('tournament_name', data.tourName);
	localStorage.setItem('tournament_id', String(data.tournamentID));
	localStorage.setItem('tournament_players', JSON.stringify(state.currentTournamentPlayers));

	showPongMenu();
}


export function handleUpdateTournamentList(data: Interfaces.SocketMessageMap['updateTourList']) {
	if (!state.currentTournamentID || data.tournamentID !== state.currentTournamentID)
		return;

	state.currentTournamentPlayers = data.members.map(m => m.username);

	localStorage.setItem('tournament_players', JSON.stringify(state.currentTournamentPlayers));
	showPongMenu();
}

