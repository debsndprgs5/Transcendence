import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import * as chatMgr from '../db/chatManagement';
import * as UserManagement from '../db/userManagement';
// import * as gameMgr from '../db/gameManagement';
// import MappedPlayers from '../websockets/game.socket';
import MappedClient from '../websockets/chat.socket'

export async function gameRoutes(fastify: FastifyInstance) {

	//Join random MMR
	fastify.post('/pong/random/:userID', async(request,reply) => {
		try{
			await joinRandomMatch(request, reply);
		}
		catch(error){
			console.error('Error in /api/pong/random/:userID', error);
					return reply.code(500).send({ 
							error: 'Internal server error'}); 
		}
	});
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
	//UserID create a tournament 
	fastify.post('/pong/tournament/:userID', async(request, reply) => {
		try{
			await createTournament(request,reply);
		}
		catch(error){
			console.error('Error in /api/pong/tournament/:userID', error);
					return reply.code(500).send({ 
							error: 'Internal server error'}); 
		}
	});
	//UserID leaves a match
	fastify.delete('/pong/:gameID/:userID', async(request, reply) => {
		try{
			await leaveMatch(request,reply);
		}
		catch(error){
			console.error('Error in /api/pong/:gameID/:userID', error);
					return reply.code(500).send({ 
							error: 'Internal server error'}); 
		}
	});
	//UserID leaves a tournament
	fastify.delete('/pong/:tournamentID/:userID', async(request,reply) => {
			try{
			await leaveTournament(request,reply);
		}
		catch(error){
			console.error('Error in /api/pong/:tournamentID/:userID', error);
					return reply.code(500).send({ 
							error: 'Internal server error'}); 
		}
	});
	// invite targetID to a match
	fastify.post('/pong/:gameID/targetID', async(request,reply) => {
			try{
			await joinInviteMatch(request, reply);
		}
		catch(error){
			console.error('Error in /api/pong/:gameID/targetID', error);
					return reply.code(500).send({ 
							error: 'Internal server error'}); 
		}
	});
	// invite targetID to a tournament 
	fastify.post('/pong/:tournamentID/targetID', async(request, reply) => {
		try{
			await joinInviteTournament(request,reply);
		}
		catch(error){
			console.error('Error in /api/pong/:tournamentID/targetID', error);
					return reply.code(500).send({ 
							error: 'Internal server error'}); 
		}
	});
	//Accept or decline Invitation
	fastify.post('/pong/replyinvite/:gameID/:userID', async(request, reply)=> {
		try{
			await acceptOrDeclineGame(request, reply);
		}
		catch(error){
			console.error('Error in /api/pong/replyinvite/:gameID/:userID', error);
					return reply.code(500).send({ 
							error: 'Internal server error'}); 
		}
	});

}	

export async function joinRandomMatch(request:FastifyRequest, reply:FastifyReply){
	//Put in wait queue for another player to be found, handled in game.socket
	//IF game founded -> founded = await getPlayerForRandom()
	// reply back with roomID and alias
}

export async function createGameRoom(request:FastifyRequest, reply:FastifyReply){
	//Create gameRoom and a related chatRoom, adds the userID in that room
	//reply back with gameRoomID: , chatRoomID: , chatName:'current Game' 
}

export async function createTournament(request:FastifyRequest, reply:FastifyReply){
	//Create tournament and a related chatRoom
	//adds UserID in the chatRoom
	//reply with TournamentID:, chatRoomID:, chatName:'Tournament'
}

export async function leaveMatch(request:FastifyRequest, reply:FastifyReply){
	//If I end match with socket what is that route for ? 
}

export async function leaveTournament(request:FastifyRequest, reply:FastifyReply){
	//Same here maybe sending sockets is most optimal 
}

export async function joinInviteMatch(request:FastifyRequest, reply:FastifyReply){
	//Player is sending invitation to TargetID to joinRoomID
	//check if TargetID is in MappeDClients and not in MappedPlayers
	//if target ID in player or NOT in clients -> send back (not possible to invite)
	//Back should ask back targetID trough socket ? 
}

export async function joinInviteTournament(request:FastifyRequest, reply:FastifyReply){
	//Same logic then Matches ? 
}

export async function acceptOrDeclineGame(request:FastifyRequest, reply:FastifyReply){
	//body{response: 'accept' | 'decline'}
	//accept -> adds in db , reply back success, rest is handle in socket ? 
	//decline -> send socket back to roomID-> msg system(uID decline...)
}

export async function acceptOrDeclineTournament(request:FastifyRequest, reply:FastifyReply){
	//same logic but for tournament 
	//go back to socket to check if tournament can start
	//decline-> send socket back to those waiting for answer 
}