import path from 'path'
import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { authRoutes } from './routes/auth.routes'

async function bootstrap() {
  const app = Fastify()

  // sert tous les fichiers de client/ (CSS, app.js, etc.)
  app.register(fastifyStatic, {
    root: path.join(__dirname, '../client'),
    prefix: '/'
  })

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
