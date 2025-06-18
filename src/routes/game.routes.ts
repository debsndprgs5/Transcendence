import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import * as chatMgr from '../db/chatManagement';
import * as UserManagement from '../db/userManagement';
import * as gameMgr from '../db/gameManagement';
// import MappedPlayers from '../websockets/game.socket';
//import MappedClient from '../websockets/chat.socket'

export async function gameRoutes(fastify: FastifyInstance) {

	console.log('[GAME][ROUTES]');
	//UserID create a game 
	fastify.post('/pong/:userID', async(request,reply) => {
		console.log('[GAME][ROUTES][POST][CREATEGAME]');
		try{
			await createGameRoom(request,reply);
		}
		catch(error){
			console.error('Error in /api/pong/random/:userID', error);
			return reply.code(500).send({ 
					error: 'Internal server error'}); 
		}
	});
	fastify.get('/pong/list', async(request, reply)=>{
		try {
			await getGameList(request,reply);
		}
		catch(error){
			console.error('Error in /api/pong/list', error);
			return reply.code(500).send({ 
					error: 'Internal server error'}); 
		}
	});
	// get all the users in a room by roomID
	fastify.get('/pong/:roomID/list', async (request, reply) => {
		try {
			const gameID = Number((request.params as any).roomID);
			const members = await gameMgr.getAllMembersFromGameRoom(gameID);
			return reply.send(members);
		} catch (error) {
			console.error('Error in get /api/pong/:roomID/list : ', error);
			return reply.code(500).send({ error: 'Internal server error' });
		}
	});
}


export async function createGameRoom(request: FastifyRequest, reply: FastifyReply) {
	try {
		const body = request.body as { userID: number; name?: string, ball_speed:number, paddle_speed:number }; // adjust if more fields needed

		const mode = 'duo';
		const type = 'public';
		const state = 'waiting';
		const rules = JSON.stringify({
			ball_speed:body.ball_speed, 
			paddle_speed:body.paddle_speed,
			win_condition:'time',
			limit:25 });
		if(!body.name)
			return;
		const gameID = await gameMgr.createGameRoom(type, state, mode, rules, body.name, body.userID);

		if (gameID) {
			reply.send({
				success: true,
				room: {
					gameID,
					gameName: body.name,
					createdBy: body.userID
				}
			});
		} else {
			reply.status(500).send({ success: false, message: 'Failed to create game room' });
		}
	} catch (error) {
		console.error('Error in createGameRoom:', error);
		reply.status(500).send({ success: false, message: 'Server error' });
	}
}


export async function getGameList(request: FastifyRequest, reply: FastifyReply) {
	try {
		const list = await gameMgr.getAllPublicGames(); // assume it returns [{ gameID, name }, ...]

		reply.send({
			success: true,
			games: list.map(room => ({
				gameID: room.gameID,
				name: room.name
			}))
		});
	} catch (error) {
		console.error('Error in getGameList:', error);
		reply.status(500).send({ success: false, message: 'Failed to fetch games' });
	}
}

