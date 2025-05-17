import { FastifyInstance } from 'fastify';
import { FastifyRequest, FastifyReply } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import * as UserManagement from '../db/userManagement';

import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET!;

export default async function accountRoutes(fastify: FastifyInstance) {
	fastify.register(fastifyMultipart);

	fastify.post('/users/me/avatar', async (request: FastifyRequest, reply: FastifyReply) => {
	  const auth = request.headers.authorization;
	  if (!auth) return reply.code(401).send({ error: 'No token' });
	  const token = auth.split(' ')[1];
	  let payload;
	  try { 
		payload = jwt.verify(token, JWT_SECRET);
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
}