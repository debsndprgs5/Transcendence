import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as gameMgr from '../db/gameManagement';

export async function tournamentRoutes(fastify: FastifyInstance) {
	//    Create new tournament : POST /api/tournament/:userID
	//    expected body (JSON) :
	//    {
	//      "round": <number>,
	//      "players_data": <string (JSON)>  // "[]" or {"bracket": ...}
	//    }

	fastify.post('/tournament/:userID', async (request: FastifyRequest, reply: FastifyReply) => {
		console.log('[TOURNAMENT][ROUTES][POST][CREATETOURNAMENT]');
		try {
			const userID = Number((request.params as any).userID);
			const body = request.body as { round: number; players_data: string };

			if (typeof body.round !== 'number' || typeof body.players_data !== 'string') {
				return reply.code(400).send({ success: false, message: 'Error : Invalid payload' });
			}

			// Create tournament and get the generated ID
			const result = await gameMgr.createTournament(body.round, body.players_data);
			const newTournamentID = (result as any).lastID as number;

			await gameMgr.addMemberToTournament(newTournamentID, userID, 'TournamentOwner');

			return reply.status(201).send({
				success: true,
				tournament: {
					tournamentID: newTournamentID,
					round: body.round,
					players_data: body.players_data
				}
			});
		} catch (error) {
			console.error('Error in POST /api/tournament/:userID:', error);
			return reply.code(500).send({ success: false, message: 'Server error' });
		}
	});

	// Get the tournament list : GET /api/tournament/list
	fastify.get('/tournament/list', async (request: FastifyRequest, reply: FastifyReply) => {
		console.log('[TOURNAMENT][ROUTES][GET][LISTTournaments]');
		try {
			const all = await gameMgr.getAllTournaments();
			// Return an array
			return reply.send({
				success: true,
				tournaments: (all as { tournamentID: number; round: number; players_data: string }[]).map(t => ({
					tournamentID: t.tournamentID,
					round: t.round,
					players_data: t.players_data
				}))
			});
		} catch (error) {
			console.error('Error in GET /api/tournament/list:', error);
			return reply.code(500).send({ success: false, message: 'Failed to fetch tournaments' });
		}
	});

	// 3) Get a specific tournament's infos (round + players_data) : GET /api/tournament/:tournamentID
	fastify.get('/tournament/:tournamentID', async (request: FastifyRequest, reply: FastifyReply) => {
		console.log('[TOURNAMENT][ROUTES][GET][GETTOURNAMENTDATA]');
		try {
			const tournamentID = Number((request.params as any).tournamentID);
			const data = await gameMgr.getTournamentData(tournamentID);
			if (!data) {
				return reply.code(404).send({ success: false, message: 'Tournament not found' });
			}
			return reply.send({
				success: true,
				tournament: {
					tournamentID: data.tournamentID,
					round: data.round,
					players_data: data.players_data
				}
			});
		} catch (error) {
			console.error('Error in GET /api/tournament/:tournamentID:', error);
			return reply.code(500).send({ success: false, message: 'Server error' });
		}
	});

	// 4) Delete a tournament : DELETE /api/tournament/:tournamentID
	fastify.delete('/tournament/:tournamentID', async (request: FastifyRequest, reply: FastifyReply) => {
		console.log('[TOURNAMENT][ROUTES][DELETE][DELTournament]');
		try {
			const tournamentID = Number((request.params as any).tournamentID);
			await gameMgr.delTournament(tournamentID);
			return reply.send({ success: true, message: 'Tournament deleted' });
		} catch (error) {
			console.error('Error in DELETE /api/tournament/:tournamentID:', error);
			return reply.code(500).send({ success: false, message: 'Server error' });
		}
	});

	// 5) Mettre à jour le players_data d’un tournoi (par ex. pour setter le bracket) :
	//    PUT /api/tournament/:tournamentID/data
	//    Body attendu : { "players_data": "<nouveau JSON string>" }
	fastify.put('/tournament/:tournamentID/data', async (request: FastifyRequest, reply: FastifyReply) => {
		console.log('[TOURNAMENT][ROUTES][PUT][UPDATETOURNAMENTDATA]');
		try {
			const tournamentID = Number((request.params as any).tournamentID);
			const body = request.body as { players_data: string };
			if (typeof body.players_data !== 'string') {
				return reply.code(400).send({ success: false, message: 'Invalid payload' });
			}
			await gameMgr.updateTournamentData(tournamentID, body.players_data);
			return reply.send({ success: true, message: 'Tournament data updated' });
		} catch (error) {
			console.error('Error in PUT /api/tournament/:tournamentID/data:', error);
			return reply.code(500).send({ success: false, message: 'Server error' });
		}
	});

	// 6) Mettre à jour le round courant d’un tournoi :
	//    PUT /api/tournament/:tournamentID/round
	//    Body attendu : { "round": <nouveau round (number)> }
	fastify.put('/tournament/:tournamentID/round', async (request: FastifyRequest, reply: FastifyReply) => {
		console.log('[TOURNAMENT][ROUTES][PUT][UPDATEROUND]');
		try {
			const tournamentID = Number((request.params as any).tournamentID);
			const body = request.body as { round: number };
			if (typeof body.round !== 'number') {
				return reply.code(400).send({ success: false, message: 'Invalid payload' });
			}
			await gameMgr.updateTournamentRound(tournamentID, body.round);
			return reply.send({ success: true, message: 'Tournament round updated' });
		} catch (error) {
			console.error('Error in PUT /api/tournament/:tournamentID/round:', error);
			return reply.code(500).send({ success: false, message: 'Server error' });
		}
	});

	// 7) Inscrire (joindre) un utilisateur à un tournoi :
	//    POST /api/tournament/:tournamentID/join/:userID
	fastify.post('/tournament/:tournamentID/join/:userID', async (request: FastifyRequest, reply: FastifyReply) => {
		console.log('[TOURNAMENT][ROUTES][POST][JOINTOURNAMENT]');
		try {
			const tournamentID = Number((request.params as any).tournamentID);
			const userID = Number((request.params as any).userID);
			const body = request.body as { alias?: string }; // alias facultatif

			// Vérifier si l’utilisateur est déjà membre
			const existingMembers = await gameMgr.getAllTournamentMembers(tournamentID);
			if (existingMembers.find(m => m.userID === userID)) {
				return reply.code(400).send({ success: false, message: 'Already registered' });
			}

			await addMemberToTournament(tournamentID, userID, body?.alias ?? null);
			return reply.send({ success: true, message: 'Joined tournament' });
		} catch (error) {
			console.error('Error in POST /api/tournament/:tournamentID/join/:userID:', error);
			return reply.code(500).send({ success: false, message: 'Server error' });
		}
	});

	// 8) Récupérer la liste des membres d’un tournoi :
	//    GET /api/tournament/:tournamentID/members
	fastify.get('/tournament/:tournamentID/members', async (request: FastifyRequest, reply: FastifyReply) => {
		console.log('[TOURNAMENT][ROUTES][GET][GETMEMBERS]');
		try {
			const tournamentID = Number((request.params as any).tournamentID);
			const members = await gameMgr.getAllTournamentMembers(tournamentID);
			return reply.send({ success: true, members });
		} catch (error) {
			console.error('Error in GET /api/tournament/:tournamentID/members:', error);
			return reply.code(500).send({ success: false, message: 'Server error' });
		}
	});
}
