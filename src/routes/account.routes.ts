import { FastifyInstance } from 'fastify';
import { FastifyRequest, FastifyReply } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import * as UserManagement from '../db/userManagement';

import jwt from 'jsonwebtoken';

export default async function accountRoutes(fastify: FastifyInstance) {
	fastify.register(fastifyMultipart);

	fastify.post('/users/me/avatar', async (request: FastifyRequest, reply: FastifyReply) => {
	  const auth = request.headers.authorization;
	  if (!auth) return reply.code(401).send({ error: 'No token' });
	  const token = auth.split(' ')[1];
	  let payload;
	  try { 
		payload = jwt.verify(token, fastify.vault.jwt);
	  } catch {
		return reply.code(401).send({ error: 'Invalid token' });
	  }
	  const user = await UserManagement.getUserByRand(String(payload.sub));
	  if (!user) return reply.code(404).send({ error: 'User not found' });

	  const data = await request.file();
	  if (!data) return reply.code(400).send({ error: 'No file uploaded' });

	  // Save to disk after resizing/cropping
	  const filename = `avatar_${user.our_index}_${Date.now()}.png`;
	  const filePath = path.join(process.cwd(), 'client/avatars', filename);

	  const buffer = await data.toBuffer();
	  // Resize + crop to square 256x256
	  await sharp(buffer)
		.resize(256, 256)
		.png()
		.toFile(filePath);

	  const avatarUrl = `/avatars/${filename}`;
	  await UserManagement.setAvatarUrl(user.our_index, avatarUrl);
	  console.log('Sending avatarUrl:', avatarUrl);

	  reply.send({ avatarUrl });
	});

	fastify.get('/users/:username/avatar', async (request, reply) => {
		try {
			const { username } = request.params as { username: string };
			if (!username) {
				return reply.code(400).send({ error: 'Username required'});
			}
			const obj = await UserManagement.getAvatarUrl(username);
			if (!obj)
				return reply.code(404).send({ error: 'No avatar found'});
			return reply.send({
				avatar_url: obj.avatar_url
			});
			console.log('AVATAR EN BACK = ', obj!.avatar_url)
		} catch (error) {
			console.error('Error getting avatar : ', error);
			return reply.code(500).send({ error: 'Internal server error' });
		}
	});

	/*
	fastify.get('/friends', async (request, reply) => {
			const currentUserId = getUserId(request, reply);
			if (currentUserId === undefined) return;
			const friends = await chatMgr.getFriends(currentUserId);
			return reply.send(friends);
		});
	*/


// get other people's profile

	fastify.get('/users/username/:username', async (request, reply) => {
	  try {
		const { username } = request.params as { username: string };
		if (!username) {
		  return reply.code(400).send({ error: 'Username parameter is required' });
		}
		const user = await UserManagement.getUserByName(username);
		if (!user || !user.our_index) {
		  return reply.code(404).send({ error: `User "${username}" not found` });
		}
		// Only public infos
		return reply.send({
		  userId: user.our_index,
		  username: user.username,
		  avatarUrl: user.avatar_url ?? null,
		});
	  } catch (error) {
		console.error('Error in /users/username/:username:', error);
		return reply.code(500).send({ error: 'Internal server error' });
	  }
	});
}