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
exports.authRoutes = authRoutes;
const bcrypt_1 = __importDefault(require("bcrypt")); // Blowfish encrypting
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken")); // Json web token -> one-time token
const speakeasy_1 = __importDefault(require("speakeasy")); // lib that supports 2fa using time based one-time pass (TOTP) and HOTP
const UserManagement = __importStar(require("../db/userManagement"));
const dotenv = __importStar(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv.config({
    path: path_1.default.resolve(process.cwd(), '.env'),
});
// SECRET KEY to sign JWT (.env)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is not defined");
}
// Big function called by main.ts to mount auth routes
async function authRoutes(fastify) {
    // 1) Route POST /api/auth/register ------------------------------------ REGISTER
    fastify.post('/auth/register', async (request, reply) => {
        // a) Read Json body as request.body
        const { username, password } = request.body;
        // b) Micro verif if password & username are set
        if (!username || !password) {
            return reply.code(400).send({ error: 'Incomplete Username or Password' });
        }
        // a) Look for user in db
        const newUser = await UserManagement.getUserByName(username);
        if (newUser != null) {
            return reply.code(400).send({ error: 'Name allready in use' });
        }
        //b) No user in bd with same name, we create a new user 	
        // Password hashing using bcrypt
        const passwordHash = await bcrypt_1.default.hash(password, 12);
        //Create simple ID (with timestamp + random)
        const id = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        //Create the user in the database
        await UserManagement.createUser(id, username, passwordHash);
        //Success feedback
        return reply.code(201).send({ message: 'Registered successfully', userId: id });
    });
    // 2) Route POST /api/auth/login ------------------------------------------ LOGIN
    fastify.post('/auth/login', async (request, reply) => {
        try {
            const { username, password } = request.body;
            if (!username || !password) {
                return reply.code(400).send({ error: 'Username and password are required' });
            }
            const user = await UserManagement.getUserByName(username);
            if (!user) {
                return reply.code(401).send({ error: 'Invalid credentials' });
            }
            const valid = await bcrypt_1.default.compare(password, user.password_hashed);
            if (!valid) {
                return reply.code(401).send({ error: 'Invalid credentials' });
            }
            // Création du token avec le bon format
            const token = jsonwebtoken_1.default.sign({
                sub: user.rand_id,
                step: '2fa' // Important: this flag indicates 2FA setup/verify is needed
            }, JWT_SECRET, { expiresIn: '5m' });
            return reply.send({
                token,
                need2FASetup: !user.totp_secret,
                need2FAVerify: !!user.totp_secret
            });
        }
        catch (error) {
            console.error('Login error:', error);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });
    // 3) Route POST /api/auth/2fa/setup
    fastify.post('/auth/2fa/setup', async (request, reply) => {
        try {
            // Vérification du token d'autorisation
            const auth = request.headers.authorization;
            if (!auth) {
                return reply.code(401).send({ error: 'No token provided' });
            }
            const token = auth.split(' ')[1];
            if (!token) {
                return reply.code(401).send({ error: 'Invalid authorization format' });
            }
            let payload;
            try {
                payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            }
            catch (error) {
                console.error('Token verification failed:', error);
                return reply.code(401).send({ error: 'Invalid token' });
            }
            if (payload.step !== '2fa') {
                return reply.code(400).send({
                    error: 'Token not in 2FA setup mode',
                    details: 'Current step: ' + payload.step
                });
            }
            // Récupération de l'utilisateur
            const rand_user = await UserManagement.getUserByRand(payload.sub);
            if (!rand_user) {
                return reply.code(404).send({ error: 'User not found' });
            }
            // Génération du secret TOTP
            const secret = speakeasy_1.default.generateSecret({
                name: encodeURIComponent(`ft_transcendence(${rand_user.username})`)
            });
            // Sauvegarde du secret dans la base de données
            try {
                await UserManagement.setTotp(rand_user.our_index, secret.base32);
            }
            catch (error) {
                console.error('Failed to save TOTP secret:', error);
                return reply.code(500).send({ error: 'Failed to save 2FA configuration' });
            }
            // Envoi de la réponse
            return reply.send({
                otpauth_url: secret.otpauth_url,
                base32: secret.base32
            });
        }
        catch (error) {
            console.error('2FA setup error:', error);
            return reply.code(500).send({
                error: 'Internal server error during 2FA setup',
            });
        }
    });
    // 4) Route POST /api/auth/2fa/verify -------------------------------------------- Verify 2FA
    fastify.post('/auth/2fa/verify', async (request, reply) => {
        const { code } = request.body;
        const auth = (request.headers.authorization || '').split(' ')[1]; // get the token only
        if (!auth)
            return reply.code(401).send({ error: 'No token' });
        let payload;
        try {
            payload = jsonwebtoken_1.default.verify(auth, JWT_SECRET);
        }
        catch {
            return reply.code(401).send({ error: 'Invalid token' });
        }
        if (payload.step !== '2fa') {
            return reply.code(400).send({ error: 'Token says 2FA is not in setup mode : Did you already setup 2FA ?' });
        }
        const user = await UserManagement.getUserByRand(payload.sub);
        if (!user || !user.totp_secret) {
            return reply.code(404).send({ error: 'Invalid User' });
        }
        // Verify code with the stocked secret using speakeasy lib
        const ok = speakeasy_1.default.totp.verify({
            secret: user.totp_secret,
            encoding: 'base32',
            token: code
        });
        if (!ok) {
            return reply.code(400).send({ error: 'Invalid 2fa code' });
        }
        // Final JWT generation
        const token = jsonwebtoken_1.default.sign({ sub: user.rand_id }, JWT_SECRET, { expiresIn: '1h' });
        return reply
            .setCookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            sameSite: 'lax',
            maxAge: 3600
        })
            .setCookie('userId', String(user.our_index), {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            sameSite: 'lax',
            maxAge: 3600,
            signed: true
        })
            .send({
            token,
            userId: user.our_index // Ajoutez l'userId dans la réponse
        });
    });
    // Helper API to get the userId (i couldnt unsign the userId token in front)
    fastify.get('/auth/me', async (request, reply) => {
        const raw = request.cookies?.userId;
        if (!raw) {
            return reply.code(401).send({ error: 'Missing userId cookie' });
        }
        const { valid, value } = request.unsignCookie(raw);
        if (!valid) {
            return reply.code(401).send({ error: 'Invalid userId cookie' });
        }
        const userId = Number(value);
        if (isNaN(userId)) {
            return reply.code(400).send({ error: 'Malformed userId cookie' });
        }
        return reply.send({ userId });
    });
    // Return the current user's profile
    fastify.get('/users/me', async (request, reply) => {
        const auth = request.headers.authorization;
        if (!auth)
            return reply.code(401).send({ error: 'No token' });
        const token = auth.split(' ')[1];
        if (!token)
            return reply.code(401).send({ error: 'Invalid authorization format' });
        let payload;
        try {
            payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        }
        catch (error) {
            return reply.code(401).send({ error: 'Invalid token' });
        }
        const user = await UserManagement.getUserByRand(String(payload.sub));
        if (!user)
            return reply.code(404).send({ error: 'User not found' });
        return reply.send({
            userId: user.our_index,
            username: user.username,
            avatarUrl: user.avatar_url || null,
            has2fa: !!user.totp_secret
        });
    });
    // Change password
    fastify.post('/users/me/password', async (request, reply) => {
        const auth = request.headers.authorization;
        if (!auth)
            return reply.code(401).send({ error: 'No token' });
        const token = auth.split(' ')[1];
        let payload;
        try {
            payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        }
        catch {
            return reply.code(401).send({ error: 'Invalid token' });
        }
        const user = await UserManagement.getUserByRand(String(payload.sub));
        if (!user)
            return reply.code(404).send({ error: 'User not found' });
        const { newPassword } = request.body;
        if (!newPassword || newPassword.length < 4)
            return reply.code(400).send({ error: 'Password too short' });
        const hashed = await bcrypt_1.default.hash(newPassword, 12);
        await UserManagement.setPasswordH(user.our_index, hashed);
        reply.send({ success: true });
    });
}
