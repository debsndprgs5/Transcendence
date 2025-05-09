import { FastifyInstance } from 'fastify';

import sqlite3 from 'sqlite3';

sqlite3.verbose();

const db = new sqlite3.Database('./userdata.db', (err) => {
  if (err) {
    console.error('Failed to connect to the database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

export default fp(async function (fastify: FastifyInstance) {
  fastify.decorate('db', db);

  fastify.addHook('onClose', (instance, done) => {
    db.close(done);
  });
});