// import path from 'path'
// import Fastify from 'fastify'
// import fastifyStatic from '@fastify/static'
// import { authRoutes } from './routes/auth.routes'
// import chatRoutes from './routes/chat.routes'
// import accountRoutes from './routes/account.routes'
// import cookie from '@fastify/cookie';
// import wsPlugin from './websockets/chat.socket';
// import * as dotenv from 'dotenv';
// import dbPlugin from './db/db';


// dotenv.config({
//   path: path.resolve(process.cwd(), '.env'),
// });

// // In your server configuration
// const extractComputerName = () => {
//     const sessionManager = process.env.SESSION_MANAGER || '';
    
//     // Using regex
//     const match = sessionManager.match(/local\/([^.]+)/);
//     if (match && match[1]) {
//         return match[1]; // Will return "c1r6p3"
//     }
    
//     // Alternative using string manipulation
//     const parts = sessionManager.split('/');
//     if (parts.length > 1) {
//         return parts[1].split('.')[0]; // Will return "c1r6p3"
//     }
    
//     return 'localhost'; // Default fallback
// };


// async function bootstrap() {
//   const app = Fastify()

//   // Configuration CORS
//   await app.register(require('@fastify/cors'), {
//     origin: true,
//     credentials: true
//   });

//   // Cookie plugin avec configuration correcte
//   await app.register(cookie, {
//     secret: process.env.COOKIE_SECRET || '&hotzBs@bziCO$oy2xTY0pq7QiBJ9Jz4Clgb$@od0MWzuU*ybL', // secret pour signer les cookies
//     parseOptions: {  // options pour le parsing des cookies
//       secure: process.env.NODE_ENV === 'production',
//       httpOnly: false,
//       sameSite: 'lax',
// 	  domain: extractComputerName(),
//       path: '/'
//     }
//   });

//   // Mount client service (CSS, app.js ...)
//   await app.register(fastifyStatic, {
//     root: '/app/client/',
//     prefix: '/'
//   })
// // await app.register(fastifyStatic, {
// //   root: path.join(__dirname, '../client'),  // Use relative path from dist/
// //   prefix: '/',
// //   decorateReply: false,
// //   setHeaders: (res, filePath) => {
// //     // Set correct MIME types
// //     if (filePath.endsWith('.js')) {
// //       res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
// //     } else if (filePath.endsWith('.css')) {
// //       res.setHeader('Content-Type', 'text/css; charset=utf-8');
// //     }
// //   }
// // })

//   // Mount WS plugin
//   await app.register(wsPlugin);

//   // Mount API Routes
//   await app.register(async (fastify) => {
//     // Health check
//     fastify.get('/health', () => ({ ok: true }))
  
//   await app.register(dbPlugin);
//     // Auth routes
//     try {
//       await fastify.register(authRoutes)
//     } catch (err) {
//       console.error('Error registering auth routes:', err)
//     }

//     // Chat routes
//     try {
//       await fastify.register(chatRoutes)
//     } catch (err) {
//       console.error('Error registering chat routes:', err)
//     }

//     // Account routes
//     try {
//       await fastify.register(accountRoutes)
//     } catch (err) {
//       console.error('Error registering account routes:', err)
//     }
//   }, { prefix: '/api' })

//   // Pour toute autre requête non-api, envoi de index.html
//   app.setNotFoundHandler((request, reply) => {
//     if (request.method === 'GET' && !request.url.startsWith('/api')) {
//       return reply.sendFile('index.html')
//     }
//     reply.callNotFound()
//   })

//   // Gestion globale des erreurs
//   app.setErrorHandler((error, request, reply) => {
//     console.error('Server error:', error);
//     reply.status(500).send({
//       error: 'Internal Server Error',
//       message: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   });

//   try {
//     await fastify.listen({
//     port: 1400,
//     host: '0.0.0.0',
//     // Add this configuration
//     serverFactory: (handler, opts) => {
//         return require('http').createServer((req, res) => {
//             // Ensure proper hostname handling
//             req.hostname = req.headers.host?.split(':')[0];
//             handler(req, res);
//         });
//     }
// 	});   
//     console.log('🚀 Server listening on http://0.0.0.0:3000');
//   } 
//   catch (err) {
//     console.error('Error starting server:', err);
//     process.exit(1);
//   }
// }

// // Gestion des erreurs non capturées
// process.on('unhandledRejection', (err) => {
//   console.error('Unhandled rejection:', err);
//   process.exit(1);
// });

// process.on('uncaughtException', (err) => {
//   console.error('Uncaught exception:', err);
//   process.exit(1);
// });

// bootstrap().catch(err => {
//   console.error('Failed to start server:', err);
//   process.exit(1);
// });
import path from 'path'
import Fastify, { FastifyInstance, FastifyServerFactory } from 'fastify'
import fastifyStatic from '@fastify/static'
import { authRoutes } from './routes/auth.routes'
import chatRoutes from './routes/chat.routes'
import accountRoutes from './routes/account.routes'
import fastifyCookie, { FastifyCookieOptions } from '@fastify/cookie'  // Add type import here
import fastifyCors from '@fastify/cors'
import wsPlugin from './websockets/chat.socket'
import * as dotenv from 'dotenv'
import dbPlugin from './db/db'
import { IncomingMessage, ServerResponse } from 'http'
import { createServer } from 'http'

// Load environment variables
dotenv.config({
    path: path.resolve(process.cwd(), '.env'),
});

// Hostname extraction utility
const extractComputerName = (): string => {
    const sessionManager = process.env.SESSION_MANAGER || '';
    const match = sessionManager.match(/local\/([^.]+)/);
    if (match && match[1]) {
        return match[1];
    }
    return 'localhost';
};

// Custom server factory with proper types
const customServerFactory: FastifyServerFactory = (handler, opts) => {
    return createServer((req: IncomingMessage, res: ServerResponse) => {
        if (req.headers && req.headers.host) {
            (req as any).hostname = req.headers.host.split(':')[0];
        }
        handler(req, res);
    });
};

async function bootstrap() {
    const app: FastifyInstance = Fastify({
        logger: true,
        trustProxy: true
    });

    // First register CORS
    await app.register(fastifyCors, {
        origin: true,
        credentials: true
    });


    // Register cookie plugin with correct types
   await app.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET || '&hotzBs@bziCO$oy2xTY0pq7QiBJ9Jz4Clgb$@od0MWzuU*ybL',
    parseOptions: {    
        secure: process.env.NODE_ENV === 'production',
        httpOnly: false,
        sameSite: 'lax',
        domain: extractComputerName(),
        path: '/'
    }
} as FastifyCookieOptions);

    // Static file serving
    await app.register(fastifyStatic, {
        root: '/app/client/',
        prefix: '/'
    });

    // WebSocket plugin
    await app.register(wsPlugin);

    // Database plugin
    await app.register(dbPlugin);

    // API Routes
    await app.register(async (fastify) => {
        // Health check
        fastify.get('/health', async () => ({ ok: true }));

        // Register routes
        await Promise.all([
            fastify.register(authRoutes),
            fastify.register(chatRoutes),
            fastify.register(accountRoutes)
        ]);
    }, { prefix: '/api' });

    // Not found handler
    app.setNotFoundHandler((request, reply) => {
        if (request.method === 'GET' && !request.url.startsWith('/api')) {
            return reply.sendFile('index.html');
        }
        reply.callNotFound();
    });

    // Global error handler
    app.setErrorHandler((error, request, reply) => {
        console.error('Server error:', error);
        reply.status(500).send({
            error: 'Internal Server Error',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    });

    try {
        const port = 1400;
        const host = '0.0.0.0';

        // Use the correct listen options
        await app.listen({
            port,
            host
        });

        console.log(`🚀 Server listening on http://${host}:${port}`);
        console.log(`Computer name: ${extractComputerName()}`);
    } catch (err) {
        console.error('Error starting server:', err);
        process.exit(1);
    }
}

// Error handling
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