import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import vaultClient from 'node-vault';

// Déclare les types pour les secrets que nous allons ajouter à Fastify
declare module 'fastify' {
  interface FastifyInstance {
    vault: {
      jwt: string;
      cookie: string;
    };
  }
}

// La fonction du plugin
async function configPlugin(fastify: FastifyInstance) {
  try {
    fastify.log.info('Initializing Vault client...');

    const vaultAddr = process.env.VAULT_ADDR || 'http://vault:8200';
    const rootToken = process.env.VAULT_ROOT_TOKEN;

    if (!rootToken) {
      throw new Error('VAULT_ROOT_TOKEN is not set. Check if main.ts loads .env.vault correctly.');
    }

    const vault = vaultClient({
      apiVersion: 'v1',
      endpoint: vaultAddr,
      token: rootToken,
    });

    fastify.log.info('Fetching secrets from Vault at kv/transcendence...');
    
    // Pour la version 2 du KV store, le chemin de lecture est "kv/data/..."
    const response = await vault.read('kv/data/transcendence');

    if (!response || !response.data || !response.data.data) {
      throw new Error('Could not fetch secrets from Vault or path is empty.');
    }

    const jwtSecret = response.data.data.JWT_SECRET;
    const cookieSecret = response.data.data.COOKIE_SECRET;

    if (!jwtSecret || !cookieSecret) {
      throw new Error('JWT_SECRET or COOKIE_SECRET missing from Vault response.');
    }

    // On "décore" l'instance de Fastify avec les secrets
    fastify.decorate('vault', {
      jwt: jwtSecret,
      cookie: cookieSecret,
    });

    fastify.log.info('Vault secrets loaded and attached to Fastify instance.');

  } catch (err) {
    fastify.log.error('Failed to load secrets from Vault:', err);
    // On relance l'erreur pour empêcher le serveur de démarrer en cas de problème
    throw err;
  }
}

export default fp(configPlugin);