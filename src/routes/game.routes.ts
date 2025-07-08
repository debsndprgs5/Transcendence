import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import * as chatMgr from '../db/chatManagement';
import * as UserManagement from '../db/userManagement';
import * as gameMgr from '../db/gameManagement';
import * as Interfaces from '../shared/gameTypes';
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
	
	// === GET user preferences ===
	fastify.get('/pong/preferences/:userID', async (request, reply) => {
		const userID = Number((request.params as any).userID);
		try {
			const prefs = await gameMgr.getAllPref(userID);
			if (!prefs) {
				return reply.code(404).send({ success: false, message: 'Preferences not found' });
			}
			reply.send({ success: true, preferences: prefs });
		} catch (error) {
			console.error('Error in GET /pong/preferences/:userID:', error);
			reply.code(500).send({ success: false, message: 'Failed to get preferences' });
		}
	});

	// === POST update user preferences ===
	fastify.post('/pong/preferences/:userID', async (request, reply) => {
		const userID = Number((request.params as any).userID);
		const updates = request.body as Partial<Interfaces.PreferencesRow>;

		try {
			await gameMgr.setAllPref(userID, updates);
			reply.send({ success: true, message: 'Preferences updated' });
		} catch (error) {
			console.error('Error in POST /pong/preferences/:userID:', error);
			reply.code(500).send({ success: false, message: 'Failed to update preferences' });
		}
	});

	// === POST reset preferences to default ===
	fastify.post('/pong/preferences/:userID/default', async (request, reply) => {
		const userID = Number((request.params as any).userID);
		try {
			await gameMgr.setBackDefPref(userID);
			reply.send({ success: true, message: 'Preferences reset to default' });
		} catch (error) {
			console.error('Error in POST /pong/preferences/:userID/default:', error);
			reply.code(500).send({ success: false, message: 'Failed to reset preferences' });
		}
	});
}


export async function createGameRoom(request: FastifyRequest, reply: FastifyReply) {
  try {
    const body = request.body as {
      userID: number;
      name?: string;
      ball_speed: number;
      paddle_speed: number;
      mode: 'duo' | 'quatuor';
      win_condition: 'time' | 'score';
      limit: number;
    };

    if (!body.name) return reply.status(400).send({ success: false, message: 'Name required' });

    const type = 'public';
    const stateStr = 'waiting';
    // build rules JSON with selections
    const rules = JSON.stringify({
      ball_speed:    body.ball_speed,
      paddle_speed:  body.paddle_speed,
      mode:          body.mode,
      win_condition: body.win_condition,
      limit:         body.limit,
    });

    const gameID = await gameMgr.createGameRoom(type, stateStr, body.mode, rules, body.name, body.userID);

    if (!gameID) {
      return reply.status(500).send({ success: false, message: 'Failed to create game room' });
    }

    reply.send({
      success: true,
      room: {
        gameID,
        gameName: body.name,
        createdBy: body.userID
      }
    });
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

