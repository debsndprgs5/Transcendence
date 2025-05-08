"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = authRoutes;
const bcrypt_1 = __importDefault(require("bcrypt")); // Blowfish encrypting
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken")); // Json web token -> one-time token
const speakeasy_1 = __importDefault(require("speakeasy")); // lib that supports 2fa using time based one-time pass (TOTP) and HOTP
const users = new Map();
// SECRET KEY to sign JWT (.env)
const JWT_SECRET = 'jaimelespates123';
// Big function called by main.ts to mount auth routes
async function authRoutes(fastify) {
    // 1) Route POST /api/auth/register ------------------------------------ REGISTER
    fastify.post('/api/auth/register', async (request, reply) => {
        // a) Read Json body as request.body
        const { username, password } = request.body;
        // b) Micro verif if password & username are set
        if (!username || !password) {
            return reply.code(400).send({ error: 'Incomplete Username or Password' });
        }
        // c) Password hashing using bcrypt
        const passwordHash = await bcrypt_1.default.hash(password, 12);
        // d) Create simple ID (with timestamp + random)
        const id = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        // e) Stock in map -> soon to be replaced by sql inshallah
        users.set(id, { id, username, passwordHash });
        // f) Success feedback
        return reply.code(201).send({ message: 'Registered successfully', userId: id });
    });
    // 2) Route POST /api/auth/login ------------------------------------------ LOGIN
    fastify.post('/api/auth/login', async (request, reply) => {
        const { username, password } = request.body;
        if (!username || !password) {
            return reply.code(400).send({ error: 'Incomplete Username or Password' });
        }
        // a) Look for user in table (actually map)
        const user = Array.from(users.values()).find(u => u.username === username);
        if (!user) {
            return reply.code(401).send({ error: 'Invalid Username or Password' });
        }
        // b) Compare the given password with user's password hash
        const valid = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!valid) {
            return reply.code(401).send({ error: 'Invalid Username or Password' });
        }
        // c) If user didnt config 2FA yet
        if (!user.totpSecret) {
            // We create a short-life token "pending 2FA"
            const pendingToken = jsonwebtoken_1.default.sign({ sub: user.id, step: '2fa' }, JWT_SECRET, { expiresIn: '5m' });
            return reply.send({ token: pendingToken, need2FA: true });
        }
        // d) Else return final JWT
        const token = jsonwebtoken_1.default.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '1h' });
        return reply.send({ token });
    });
    // 3) Route POST /api/auth/2fa/setup ------------------------------------------- SETUP 2FA
    fastify.post('/api/auth/2fa/setup', async (request, reply) => {
        // a) We get the "pending" token via http Header Authorization: Bearer <token>
        const auth = (request.headers.authorization || '').split(' ')[1]; // split to get the token
        if (!auth)
            return reply.code(401).send({ error: 'No token : 401 Unauthorized' });
        let payload;
        try {
            payload = jsonwebtoken_1.default.verify(auth, JWT_SECRET);
        }
        catch {
            return reply.code(401).send({ error: 'Invalid Token' });
        }
        if (payload.step !== '2fa') {
            return reply.code(400).send({ error: 'Token says 2FA is not in setup mode : Did you already setup 2FA ?' });
        }
        // b) On récupère l’utilisateur
        const user = users.get(payload.sub);
        if (!user) {
            return reply.code(404).send({ error: 'Invalid User' });
        }
        // c) Génération du secret TOTP
        const secret = speakeasy_1.default.generateSecret({
            name: `ft_transcendence(${user.username})`
        });
        user.totpSecret = secret.base32;
        // d) On envoie la donnée pour le QR code
        return reply.send({
            otpauth_url: secret.otpauth_url,
            base32: secret.base32
        });
    });
    // 4) Route POST /api/auth/2fa/verify -------------------------------------------- Verify 2FA
    fastify.post('/api/auth/2fa/verify', async (request, reply) => {
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
        const user = users.get(payload.sub);
        if (!user || !user.totpSecret) {
            return reply.code(404).send({ error: 'Invalid User' });
        }
        // Verify code with the stocked secret using speakeasy lib
        const ok = speakeasy_1.default.totp.verify({
            secret: user.totpSecret,
            encoding: 'base32',
            token: code
        });
        if (!ok) {
            return reply.code(400).send({ error: 'Invalid 2fa code' });
        }
        // Final JWT generation
        const token = jsonwebtoken_1.default.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '1h' });
        return reply.send({ token });
    });
}
