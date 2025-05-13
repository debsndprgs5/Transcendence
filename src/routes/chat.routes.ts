import { FastifyInstance } from 'fastify'
import * as chatManagment from '../db/chatManagment'
import * as userManagment from '../db/userManagment'

export async function chatRoutes(fastify:FastifyInstance){
   //Route -> POST api/chat 
    fastify.post('/auth/chat', async (request, reply))
    //Middleware call to check token status
    const {username, message, room} = request.body as {username:string, message:string, room:number}
    const user = await userManagment.getUserByName(username)
    chatManagment.createMessage(user.our_index, room, message)
    if(room == 0) //chat general
       await SendGeneralMessage(message, user)
    else
        await SendRoomMessage(room, message, user)
    
    //Route -> GET api/chat/history
    fastify.get('/chat/history')
    //Middleware check here to add 
    const {uname, room} = request.body as {uname:string, room:number}
    const user = await userManagment.getUserByName(uname)
    if(!user)
        error(500)("Wierd internal error , you are hacking man ?!")
    const fullhistory = await chatManagment.getMessagesByRoom(room, 50)
    const userhistory = await chatManagment.getMessagesByUserInRoom(user.our_index, room)
    SendHistory(fullhistory, userhistory)


}


