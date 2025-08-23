import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as gameMgr from '../db/gameManagement';

export async function tournamentRoutes(fastify: FastifyInstance) {
	// Create tournament
	fastify.post('/tournament/:userID', async (request: FastifyRequest, reply: FastifyReply) => {
		
		try {
			const userID = Number((request.params as any).userID);
			const body = request.body as {
				name: string;
				status:string;
				paddleSpeed:number;
				ballSpeed:number;
				limit:number;
				chatID:number;
			};

			if (
				typeof body.name !== 'string' ||
				typeof body.paddleSpeed !== 'number' ||
				typeof body.ballSpeed !== 'number' ||
				typeof body.limit !== 'number' ||
				(body.status !== 'waiting')
			) {
				return reply.code(400).send({ success: false, message: 'Invalid payload' });
			}

			const result = await gameMgr.createTournament(
				body.name,
				userID,
				0,
				body.status,
				body.paddleSpeed,
				body.ballSpeed,
				body.limit,
				body.chatID
			);
			const newTournamentID = (result as any).lastID as number;

			return reply.status(201).send({
				success: true,
				tournament: {
					tournamentID: newTournamentID,
					name: body.name,
					createdBy: userID,
					status: body.status,
					chatID:body.chatID
				}
			});
		} catch (error) {
			console.error('Error in POST /api/tournament/:userID:', error);
			return reply.code(500).send({ success: false, message: 'Server error' });
		}
	});

	// List all tournaments
	fastify.get('/tournament/list', async (request: FastifyRequest, reply: FastifyReply) => {
		
		try {
			const all = await gameMgr.getAllTournaments();
			return reply.send({
				success: true,
				tournaments: (all as {
					tournamentID: number;
					name: string;
					createdBy: number;
					status: string;
				}[]).map(t => ({
					tournamentID: t.tournamentID,
					name: t.name,
					createdBy: t.createdBy,
					status: t.status
				}))
			});
		} catch (error) {
			console.error('Error in GET /api/tournament/list:', error);
			return reply.code(500).send({ success: false, message: 'Failed to fetch tournaments' });
		}
	});

	// Get tournament details (infos + members list + eventually matches)
	fastify.get('/tournament/:tournamentID', async (request: FastifyRequest, reply: FastifyReply) => {
		
		try {
			const tournamentID = Number((request.params as any).tournamentID);
			const info = await gameMgr.getTournamentById(tournamentID);
			if (!info) {
				return reply.code(404).send({ success: false, message: 'Tournament not found' });
			}
			// Get registered members
			const members = await gameMgr.getAllTournamentMembers(tournamentID);
			// Get played matches
			const matches = await gameMgr.getAllMatches(tournamentID);

			return reply.send({
				success: true,
				tournament: {
					tournamentID: info.tournamentID,
					name: info.name,
					createdBy: info.createdBy,
					status: info.status,
					created_at: info.created_at,
					members, // array { userID, points, matchesPlayed }
					matches  // array { matchID, playerA, playerB, scoreA, scoreB, played_at }
				}
			});
		} catch (error) {
			console.error('Error in GET /api/tournament/:tournamentID:', error);
			return reply.code(500).send({ success: false, message: 'Server error' });
		}
	});

	// Delete tournament
	fastify.delete('/tournament/:tournamentID', async (request: FastifyRequest, reply: FastifyReply) => {
		
		try {
			const tournamentID = Number((request.params as any).tournamentID);
			await gameMgr.delTournament(tournamentID);
			return reply.send({ success: true, message: 'Tournament deleted' });
		} catch (error) {
			console.error('Error in DELETE /api/tournament/:tournamentID:', error);
			return reply.code(500).send({ success: false, message: 'Server error' });
		}
	});

	// Add a member to a tournament
	fastify.post('/tournament/:tournamentID/join/:userID', async (request: FastifyRequest, reply: FastifyReply) => {
		
		try {
			const tournamentID = Number((request.params as any).tournamentID);
			const userID = Number((request.params as any).userID);

			// Verif if already registered
			const existing = await gameMgr.getAllTournamentMembers(tournamentID);
			if (existing.find(m => m.userID === userID)) {
				return reply.code(400).send({ success: false, message: 'Already registered' });
			}

			// Register in tournamentMembers
			await gameMgr.addMemberToTournament(tournamentID, userID);
			return reply.send({ success: true, message: 'Joined tournament' });
		} catch (error) {
			console.error('Error in POST /api/tournament/:tournamentID/join/:userID:', error);
			return reply.code(500).send({ success: false, message: 'Server error' });
		}
	});

	// List a specific tournament's players
	fastify.get('/tournament/:tournamentID/members', async (request: FastifyRequest, reply: FastifyReply) => {
		
		try {
			const tournamentID = Number((request.params as any).tournamentID);
			const members = await gameMgr.getAllTournamentMembers(tournamentID);
			return reply.send({ success: true, members });
		} catch (error) {
			console.error('Error in GET /api/tournament/:tournamentID/members:', error);
			return reply.code(500).send({ success: false, message: 'Server error' });
		}
	});

	// Keep match's results
	//    expected : { playerA, playerB, scoreA, scoreB }
	fastify.post('/tournament/:tournamentID/match', async (request: FastifyRequest, reply: FastifyReply) => {
		
		try {
			const tournamentID = Number((request.params as any).tournamentID);
			const body = request.body as { playerA: number; playerB: number; scoreA: number; scoreB: number };

			if (
				typeof body.playerA !== 'number' ||
				typeof body.playerB !== 'number' ||
				typeof body.scoreA !== 'number' ||
				typeof body.scoreB !== 'number'
			) {
				return reply.code(400).send({ success: false, message: 'Invalid payload' });
			}

			// Keep results in tournamentMatches
			const result = await gameMgr.createMatchResult(
				tournamentID,
				body.playerA,
				body.playerB,
				body.scoreA,
				body.scoreB
			);
			const newMatchID = (result as any).lastID as number;

			// Update players stats in tournamentMembers
			// Victory = +10, Loose = 0, Tie = +5
			let pointsA = 0;
			let pointsB = 0;
			if (body.scoreA > body.scoreB) {
				pointsA = 10;
				pointsB = 0;
			} else if (body.scoreA < body.scoreB) {
				pointsA = 0;
				pointsB = 10;
			} else {
				pointsA = 5;
				pointsB = 5;
			}

			// Get the previous number of points/matches for player A
			const membersA = await gameMgr.getAllTournamentMembers(tournamentID);
			const recordA = membersA.find(m => m.userID === body.playerA);
			const oldPointsA      = recordA?.points ?? 0;
			const oldMatchesA     = recordA?.matchesPlayed ?? 0;
			await gameMgr.updateMemberStats(tournamentID, body.playerA, oldPointsA + pointsA, oldMatchesA + 1);

			// same for player B
			const recordB = membersA.find(m => m.userID === body.playerB);
			const oldPointsB  = recordB?.points ?? 0;
			const oldMatchesB = recordB?.matchesPlayed ?? 0;
			await gameMgr.updateMemberStats(tournamentID, body.playerB, oldPointsB + pointsB, oldMatchesB + 1);

			return reply.status(201).send({
				success: true,
				match: {
					matchID: newMatchID,
					tournamentID,
					playerA: body.playerA,
					playerB: body.playerB,
					scoreA: body.scoreA,
					scoreB: body.scoreB
				}
			});
		} catch (error) {
			console.error('Error in POST /api/tournament/:tournamentID/match:', error);
			return reply.code(500).send({ success: false, message: 'Server error' });
		}
	});

	// List a specific tournament's matches
	fastify.get('/tournament/:tournamentID/matches', async (request: FastifyRequest, reply: FastifyReply) => {
		
		try {
			const tournamentID = Number((request.params as any).tournamentID);
			const matches = await gameMgr.getAllMatches(tournamentID);
			return reply.send({ success: true, matches });
		} catch (error) {
			console.error('Error in GET /api/tournament/:tournamentID/matches:', error);
			return reply.code(500).send({ success: false, message: 'Server error' });
		}
	});
	// Leave a tournament
	fastify.post('/tournament/:tournamentID/leave/:userID', async (request, reply) => {
		try {
			const tournamentID = Number((request.params as any).tournamentID);
			const userID = Number((request.params as any).userID);
			await gameMgr.delMemberFromTournament(tournamentID, userID);
			return reply.send({ success: true, message: 'Left tournament' });
		} catch (err) {
			console.error('Error leaving tournament:', err);
			return reply.code(500).send({ success: false, message: 'Server error' });
		}
	});
	// Get the linked chat room ID of a tournament
fastify.get('/tournaments/chat/:tournamentID', async (request, reply) => {
	
	try {
		const tournamentID = Number((request.params as any).tournamentID);
		const tournament = await gameMgr.getChatIDbyTourID(tournamentID);
		if (!tournament) {
			return reply.code(404).send({ success: false, message: 'Tournament not found' });
		}
		return reply.send({ success: true, chatID: tournament.chatID });
	} catch (err) {
		console.error('Error in GET /tournaments/chat/:tournamentID:', err);
		return reply.code(500).send({ success: false, message: 'Server error' });
	}
});
}
