import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import * as chatMgr from '../db/chatManagement';
import * as UserManagement from '../db/userManagement';
import * as gameMgr from '../db/gameManagement';
 import * as gameMgr from '../db/gameManagement';
 import MappedPlayers from '../websockets/game.socket';
import MappedClient from '../websockets/chat.socket'

export async function gameRoutes(fastify: FastifyInstance) {


	//UserID create a game body:alias:
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
				try{
			await getGameList(request,reply);
		}
		catch(error){
			console.error('Error in /api/pong/random/:userID', error);
					return reply.code(500).send({ 
							error: 'Internal server error'}); 
		}
	});
	// //UserID create a tournament 
	// fastify.post('/pong/tournament/:userID', async(request, reply) => {
	// 	try{
	// 		await createTournament(request,reply);
	// 	}
	// 	catch(error){
	// 		console.error('Error in /api/pong/tournament/:userID', error);
	// 				return reply.code(500).send({ 
	// 						error: 'Internal server error'}); 
	// 	}
	// });
	// //UserID ask for targID stats
	// fastify.get('/pong/stats/:targID', async(request, reply)=>{
	// try{
	// 	await getStats(request , reply);
	// } 
	// catch(error){
	// 	console.error('Error getting stats');
	// 	return reply.code(500).send({
	// 		error: 'Internal server error'});
//  	}
// 	});

 }	


export async function createGameRoom(request:FastifyRequest, reply:FastifyReply){
	//const name = extract name from body request 
	const mode='1v1';
	const type='public';
	const state= 'waiting';
	const rules= JSON.stringify({ball_speed:0.5, paddle_speed:0.5, bounce_vel:0.1});

	//Needs to modify that one to return gameID 
	await gameID = gameMgr.createGameRoom(type, state, mode, rules);
	//reply succes if gameID 
	//send back the room the name and the userID created it, 
	//Front send back joinGame trough socket 
	//so user is set to waiting and cannot join or be invited to other games
	
}

export async function getGameList(request:FastifyRequest, reply:FastifyReply){
	//Needs that one to return [gameID, name],[...]
	const list = await  gameMgr.getAllPublicPong();
	//add List in the reply 
	//send the reply 
}

// export async function createTournament(request:FastifyRequest, reply:FastifyReply){
// 	//Create tournament and a related chatRoom
// 	//adds UserID in the chatRoom
// 	//reply with TournamentID:, chatRoomID:, chatName:'Tournament'
// }

// export async function getStats(request:FastifyRequest, reply:FastifyReply){

// }
