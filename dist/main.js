"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const fastify_1 = __importDefault(require("fastify"));
const static_1 = __importDefault(require("@fastify/static"));
const auth_routes_1 = require("./routes/auth.routes");
const chat_routes_1 = __importDefault(require("./routes/chat.routes"));
const account_routes_1 = __importDefault(require("./routes/account.routes"));
const cookie_1 = __importDefault(require("@fastify/cookie"));
const chat_socket_1 = __importDefault(require("./websockets/chat.socket"));
const dotenv = __importStar(require("dotenv"));
const db_1 = __importDefault(require("./db/db"));
dotenv.config({
    path: path_1.default.resolve(process.cwd(), '.env'),
});
async function bootstrap() {
    const app = (0, fastify_1.default)();
    // Configuration CORS
    await app.register(require('@fastify/cors'), {
        origin: true,
        credentials: true
    });
    // Cookie plugin avec configuration correcte
    await app.register(cookie_1.default, {
        secret: process.env.COOKIE_SECRET || '&hotzBs@bziCO$oy2xTY0pq7QiBJ9Jz4Clgb$@od0MWzuU*ybL', // secret pour signer les cookies
        parseOptions: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: false,
            sameSite: 'lax',
            path: '/'
        }
    });
    // Mount client service (CSS, app.js ...)
    await app.register(static_1.default, {
        root: path_1.default.join(__dirname, '../client'),
        prefix: '/'
    });
    // Mount WS plugin
    await app.register(chat_socket_1.default);
    // Mount API Routes
    await app.register(async (fastify) => {
        // Health check
        fastify.get('/health', () => ({ ok: true }));
        await app.register(db_1.default);
        // Auth routes
        try {
            await fastify.register(auth_routes_1.authRoutes);
        }
        catch (err) {
            console.error('Error registering auth routes:', err);
        }
        // Chat routes
        try {
            await fastify.register(chat_routes_1.default);
        }
        catch (err) {
            console.error('Error registering chat routes:', err);
        }
        // Account routes
        try {
            await fastify.register(account_routes_1.default);
        }
        catch (err) {
            console.error('Error registering account routes:', err);
        }
    }, { prefix: '/api' });
    // Pour toute autre requête non-api, envoi de index.html
    app.setNotFoundHandler((request, reply) => {
        if (request.method === 'GET' && !request.url.startsWith('/api')) {
            return reply.sendFile('index.html');
        }
        reply.callNotFound();
    });
    // Gestion globale des erreurs
    app.setErrorHandler((error, request, reply) => {
        console.error('Server error:', error);
        reply.status(500).send({
            error: 'Internal Server Error',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    });
    try {
        await app.listen({
            port: 3000,
            host: '0.0.0.0'
        });
        console.log('🚀 Server listening on http://0.0.0.0:3000');
    }
    catch (err) {
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
