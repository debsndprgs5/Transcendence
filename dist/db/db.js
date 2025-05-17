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
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const sqlite3_1 = __importDefault(require("sqlite3"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv = __importStar(require("dotenv"));
const userManagement_1 = require("./userManagement");
const chatManagement_1 = require("./chatManagement");
sqlite3_1.default.verbose();
dotenv.config();
const workDir = process.env.WORK_DIR;
if (!workDir) {
    throw new Error("WORK_DIR environment variable is not defined");
}
const dbPath = path_1.default.join(workDir, 'src/db/ourdatabase.db');
const schemaPath = path_1.default.join(workDir, 'src/db/schema.sql');
function initializeDatabase() {
    const db = new sqlite3_1.default.Database(dbPath, (err) => {
        if (err) {
            console.error('❌ Failed to connect to the database:', err.message);
        }
        else {
            console.log('✅ Connected to the SQLite database.');
            if (fs_1.default.existsSync(schemaPath)) {
                const schema = fs_1.default.readFileSync(schemaPath, 'utf8');
                db.exec(schema, (err) => {
                    if (err) {
                        console.error('❌ Failed to apply schema:', err.message);
                    }
                    else {
                        console.log('✅ Schema applied successfully.');
                    }
                });
            }
        }
    });
    return db;
}
// Fastify plugin
exports.default = (0, fastify_plugin_1.default)(async function (fastify, _opts) {
    const database = initializeDatabase();
    // Attach db to Fastify instance
    fastify.decorate('db', database);
    // Inject into other modules
    (0, userManagement_1.setDb)(database);
    (0, chatManagement_1.setDb)(database);
});
