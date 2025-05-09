import Fastify from 'fastify'
import { authRoutes } from './routes/auth.routes'

async function bootstrap() {
  // 1) Create Fastify instance
  const app = Fastify()

  // 2) test path on root
  app.get('/', async (request, reply) => {
    return { message: 'Hello from ft_transcendence!' }
  })

  // 3) Register the auth routes, fastify will summon and mount all POST/ap/auth routes
  // await because authroutes is async and therefore fastify will wait for any async plugin or call inside
  await app.register(authRoutes)

  // 4) Start server
  try {
    await app.listen({ port: 3000, host: '0.0.0.0' })
    console.log('Server listening on http://ip/:3000')
  } catch (err) {
    console.error('Error starting server:', err)
    process.exit(1)
  }
}

bootstrap()
