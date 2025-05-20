import path from 'path'
import Fastify from 'fastify'
import fs from 'fs'
import fastifyStatic from '@fastify/static'
import { authRoutes } from './routes/auth.routes'
import chatRoutes from './routes/chat.routes'
import accountRoutes from './routes/account.routes'
import cookie from '@fastify/cookie';
import wsPlugin from './websockets/chat.socket';
import * as dotenv from 'dotenv';
import dbPlugin from './db/db';



dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
});

async function bootstrap() {
  const keyPath = process.env.CERT_KEY_PATH || '/app/cert/key.pem';
  const certPath = process.env.CERT_CERT_PATH || '/app/cert/cert.pem';

  const key = fs.readFileSync(keyPath);
  const cert = fs.readFileSync(certPath);

  const app = Fastify({
    https: {
      key,
      cert
    }
  });


  // Configuration CORS
  await app.register(require('@fastify/cors'), {
    origin: true,
    credentials: true
  });

  // Cookie plugin avec configuration correcte
  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET || '&hotzBs@bziCO$oy2xTY0pq7QiBJ9Jz4Clgb$@od0MWzuU*ybL', // secret pour signer les cookies
    parseOptions: {  // options pour le parsing des cookies
      secure: process.env.NODE_ENV === 'production',
      httpOnly: false,
      sameSite: 'lax',
      path: '/'
    }
  });

  // Mount client service (CSS, app.js ...)
  await app.register(fastifyStatic, {
    //root: path.join(__dirname, '../client'),
	root: '/app/client',
    prefix: '/'
  })

  // Mount WS plugin
  await app.register(wsPlugin);

  // Mount API Routes
  await app.register(async (fastify) => {
    // Health check
    fastify.get('/health', () => ({ ok: true }))
  
  await app.register(dbPlugin);
    // Auth routes
    try {
      await fastify.register(authRoutes)
    } catch (err) {
      console.error('Error registering auth routes:', err)
    }

    // Chat routes
    try {
      await fastify.register(chatRoutes)
    } catch (err) {
      console.error('Error registering chat routes:', err)
    }

    // Account routes
    try {
      await fastify.register(accountRoutes)
    } catch (err) {
      console.error('Error registering account routes:', err)
    }
  }, { prefix: '/api' })

  // Pour toute autre requête non-api, envoi de index.html
  app.setNotFoundHandler((request, reply) => {
    if (request.method === 'GET' && !request.url.startsWith('/api')) {
      return reply.sendFile('index.html')
    }
    reply.callNotFound()
  })

  // Gestion globale des erreurs
  app.setErrorHandler((error, request, reply) => {
    console.error('Server error:', error);
    reply.status(500).send({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  });
	const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  try {
    await app.listen({ 
      port, 
      host: '0.0.0.0'
    });
    console.log('🚀 Server listening on http://0.0.0.0:${PORT}');
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

// Gestion des erreurs non capturées
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

bootstrap().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});