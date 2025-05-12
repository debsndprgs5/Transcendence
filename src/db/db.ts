import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

sqlite3.verbose();
// Load the .env file
dotenv.config();


const workDir = process.env.WORK_DIR;

if (!workDir) {
  throw new Error("WORK_DIR environment variable is not defined");
}

const dbPath = path.join(workDir, '/src/db/userdata.db'); // Path to the DB file
const schemaPath = path.join(workDir,'/src/db/schema.sql'); // Path to the schema file


// Open the database (it will create the file if it doesn't exist)
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Failed to connect to the database:', err.message);
  } else {
    console.log('✅ Connected to the SQLite database.');

    // Check if the database needs initialization
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      // Run the schema to create tables if they don't exist
      db.exec(schema, (err) => {
        if (err) {
          console.error('❌ Failed to apply schema:', err.message);
        } else {
          console.log('✅ Schema applied successfully.');
        }
      });
    }
  }
});

declare module 'fastify' {
  interface FastifyInstance {
    db: sqlite3.Database;
  }
}

export default fp(async function (fastify: FastifyInstance) {
  fastify.decorate('db', db);

  // Cleanup hook when the Fastify instance closes
  fastify.addHook('onClose', (_instance, done) => {
    db.close((err: Error | null) => {
      if (err) {
        done(err);
      } else {
        done();
      }
    });
  });
});
