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
exports.default = accountRoutes;
const multipart_1 = __importDefault(require("@fastify/multipart"));
const sharp_1 = __importDefault(require("sharp"));
const path_1 = __importDefault(require("path"));
const UserManagement = __importStar(require("../db/userManagement"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET;
async function accountRoutes(fastify) {
    fastify.register(multipart_1.default);
    fastify.post('/users/me/avatar', async (request, reply) => {
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
        const data = await request.file();
        if (!data)
            return reply.code(400).send({ error: 'No file uploaded' });
        // Save to disk after resizing/cropping
        const filename = `avatar_${user.our_index}_${Date.now()}.png`;
        const filePath = path_1.default.join(process.cwd(), 'client/avatars', filename);
        const buffer = await data.toBuffer();
        // Resize + crop to square 256x256
        await (0, sharp_1.default)(buffer)
            .resize(256, 256)
            .png()
            .toFile(filePath);
        const avatarUrl = `/avatars/${filename}`;
        await UserManagement.setAvatarUrl(user.our_index, avatarUrl);
        console.log('Sending avatarUrl:', avatarUrl);
        reply.send({ avatarUrl });
    });
}
