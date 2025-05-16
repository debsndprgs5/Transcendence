import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

import { setDb as setUserDb } from './userManagement';
import { setDb as setChatDb } from './chatManagement';

sqlite3.verbose();
dotenv.config();



const dbPath = 'db/ourdatabase.db';
const schemaPath = 'db/schema.sql';

// Extend FastifyInstance with `db`
declare module 'fastify' {
  interface FastifyInstance {
    db: sqlite3.Database;
  }
}

function initializeDatabase(): sqlite3.Database {

  const db = new sqlite3.Database(dbPath, (err) => {
  console.error('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')
    if (err) {
      console.error('❌ Failed to coNNect to the database:', err.message);
    } else {
      console.log('✅ Connected to the SQLite database.');

      if (fs.existsSync(schemaPath)) {
	  console.error('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')
        const schema = fs.readFileSync(schemaPath, 'utf8');
        db.exec(schema, (err) => {
		console.error('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')
          if (err) {
            console.error('❌ Failed to apply schema:', err.message);
          } else {
            console.log('✅ Schema applied successfully.');
          }
        });
      }
    }
  });

  return db;
}

// Fastify plugin
export default fp(async function (fastify: FastifyInstance, _opts) {
  const database = initializeDatabase();

  // Attach db to Fastify instance
  fastify.decorate('db', database);

  // Inject into other modules
  setUserDb(database);
  setChatDb(database);
});

