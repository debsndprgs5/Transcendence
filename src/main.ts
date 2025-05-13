import path from 'path'
import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import './db/db'
import { authRoutes } from './routes/auth.routes'
import cookie from '@fastify/cookie';

async function bootstrap() {
  const app = Fastify()

  // sert tous les fichiers de client/ (CSS, app.js, etc.)
  app.register(fastifyStatic, {
    root: path.join(__dirname, '../client'),
    prefix: '/'
  })

  const app = fastify();
  app.register(cookie, {
    // Sign the cookies to prevent client to modify-it
    secret: process.env.COOKIE_SECRET || '&hotzBs@bziCO$oy2xTY0pq7QiBJ9Jz4Clgb$@od0MWzuU*ybL',
  });

  // Toutes les routes API
  app.register(async (fastify) => {
    fastify.get('/api/health', () => ({ ok: true }))
    await fastify.register(authRoutes)
    // ... autres routes /api/*
  }, { prefix: '/api' })

  // Pour toute autre requête GET (non /api), on renvoie index.html
  app.setNotFoundHandler((request, reply) => {
    if (request.method === 'GET' && !request.url.startsWith('/api')) {
      return reply.sendFile('index.html')
    }
    reply.callNotFound()
  })

  await app.listen({ port: 3000, host: '0.0.0.0' })
  console.log('🚀 Server listening on http://0.0.0.0:3000')
}

bootstrap()
