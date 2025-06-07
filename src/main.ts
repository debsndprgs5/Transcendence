import path from 'path'
import Fastify from 'fastify'
import fs from 'fs'
import fastifyStatic from '@fastify/static'
import { authRoutes } from './routes/auth.routes'
import chatRoutes from './routes/chat.routes'
import accountRoutes from './routes/account.routes'
import cookie from '@fastify/cookie';
import wsPlugin from './websockets/chat.socket';
import gamePlugin from './websockets/game.socket';
import * as dotenv from 'dotenv';
import dbPlugin from './db/db';
import { gameRoutes } from './routes/game.routes'



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

  // 1) bundle client (JS + CSS)
  await app.register(fastifyStatic, {
    root: path.resolve(__dirname, '../client/dist'),
    prefix: '/dist/',
    decorateReply: false // on ne veut pas remplacer sendFile ici
  });

  // 2) éléments statiques (index.html, favicon…)  
  await app.register(fastifyStatic, {
    root: path.resolve(__dirname, '../client'),
    prefix: '/',
    index: false  // on servira index.html manuellement
  });



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

	//pong routes 
	try{
		await fastify.register(gameRoutes)
	}
	catch(err){
		console.error('Error registering gamesRoutes')
	}
  }, { prefix: '/api' })
  // Mount WS plugin
  await app.register(wsPlugin);
  await app.register(gamePlugin);
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
	const port = process.env.PORT ? Number(process.env.PORT) : 1400;
  try {
    await app.listen({ 
      port, 
      host: '0.0.0.0'
    });
    console.log(`🚀 Server listening on https://0.0.0.0:${port}`);
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