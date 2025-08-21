import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import * as chatMgr from '../db/chatManagement';
import * as UserManagement from '../db/userManagement';
import * as gameMgr from '../db/gameManagement';
import * as Interfaces from '../shared/gameTypes';
import { updateList } from '../websockets/game.sockHelpers';

export async function gameRoutes(fastify: FastifyInstance) {

	
	//UserID create a game 
	fastify.post('/pong/:userID', async(request,reply) => {
		
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
	await updateList();
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

