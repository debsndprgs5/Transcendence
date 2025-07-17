import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Charger les variables depuis le fichier créé par vault-init
const vaultEnvPath = path.resolve('/app', 'vault', '.env.vault'); // MODIFIÉ: Chemin absolu dans le conteneur
if (fs.existsSync(vaultEnvPath)) {
  const vaultEnv = fs.readFileSync(vaultEnvPath, 'utf8');
  const parsed = dotenv.parse(vaultEnv);
  for (const key in parsed) {
    process.env[key] = parsed[key];
  }
  console.log('Successfully loaded secrets from .env.vault');
} else {
  console.error('FATAL: .env.vault file not found at:', vaultEnvPath);
  // En production, il est souvent préférable de quitter si les secrets ne sont pas trouvés.
  // process.exit(1); 
}

import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { authRoutes } from './routes/auth.routes'
import chatRoutes from './routes/chat.routes'
import accountRoutes from './routes/account.routes'
import cookie from '@fastify/cookie';
import wsPlugin from './websockets/chat.socket';
import gamePlugin from './websockets/game.socket';

import dbPlugin from './db/db';
import { gameRoutes } from './routes/game.routes'
import { tournamentRoutes } from './routes/tournament.routes'
import vaultPlugin , { setSecrets } from './vault/vaultPlugin';



function extractHostFromSessionManager(session: string | undefined): string | null {
  if (!session) return null;
  const match = session.match(/(c\d+r\d+p\d+)/);
  return match ? `${match[1]}` : null;
}

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

  //load plugin vault // acces aux secrets comme ca : app.vault.<secretName>
  await app.register(vaultPlugin);
  
  console.log('gnngnggggg: ', app.vault.jwt);
  console.log('2222222: ', app.vault.cookie);
  setSecrets(app.vault.jwt, app.vault.cookie);
  // Config CORS
  await app.register(require('@fastify/cors'), {
  origin: true,
  credentials: true,
  prefix: '/api'
})

  // Cookie plugin
  await app.register(cookie, {
    secret: app.vault.cookie,
    parseOptions: {  // options pour le parsing des cookies
      secure: process.env.NODE_ENV === 'production',
      httpOnly: false,
      sameSite: 'lax',
      path: '/'
    }
  });

  // bundle client (JS + CSS)
  await app.register(fastifyStatic, {
    root: path.resolve(__dirname, '../client/dist'),
    prefix: '/dist/',
    decorateReply: false
  });

  // Static elems (index.html, favicon…)  
  await app.register(fastifyStatic, {
    root: path.resolve(__dirname, '../client'),
    prefix: '/',
    index: false 
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
    } catch (err) {
      console.error('Error registering game routes:', err)
    }

    // Tournaments routes
    try {
      await fastify.register(tournamentRoutes)
    } catch (err) {
      console.error('Error registering tournament routes:', err)
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

    const dynamicHost = extractHostFromSessionManager(process.env.SESSION_MANAGER) || '0.0.0.0';
    console.log(`🚀 Server listening on https://${dynamicHost}`);
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