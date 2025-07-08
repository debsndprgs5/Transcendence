import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import * as vault from 'node-vault';

// struct
export interface AppConfig {
  jwt: string;
  cookie: string;
}

// decorateur
declare module 'fastify' {
  interface FastifyInstance {
    vault: AppConfig;
  }
}

// get les secrets
async function loadConfigFromVault(): Promise<AppConfig> {
  // const secret_tmp: AppConfig = {
  //   jwt: 'JnDy&cdiQ*O&NV0vUb*Yve%5#qW3^wPMXWdxQI!P4bC*L6de34',
  //   cookie: '&hotzBs@bziCO$oy2xTY0pq7QiBJ9Jz4Clgb$@od0MWzuU*ybL'
  // };
  // return secret_tmp;

  const vaultEnvPath = path.resolve(process.cwd(), '.env.vault');
  if (fs.existsSync(vaultEnvPath)) {
    dotenv.config({ path: vaultEnvPath });
  } else {
    throw new Error('.env.vault file not found. Vault initialization may have failed.');
  }

  try {
    const options = {
      apiVersion: 'v1',
      endpoint: process.env.VAULT_ADDR,
      token: process.env.VAULT_ROOT_TOKEN,
    };
    const vaultClient = vault.default(options);
    console.log("Fetching secrets from vault...");
    
    const secretPath = 'kv/data/transcendence';
    const { data } = await vaultClient.read(secretPath);

    if (!data || !data.data || !data.data.JWT_SECRET) {
      throw new Error(`JWT_SECRET not found in Vault at path: ${secretPath}`);
    }
    
    const secrets: AppConfig = {
      jwt: data.data.JWT_SECRET,
      cookie: data.data.COOKIE_SECRET,
    };

    console.log('Secrets successfully fetched from Vault.');
    return secrets;
  } catch (error) {
    console.error('FATAL: Could not fetch secrets from Vault. Shutting down.', error);
    process.exit(1);
  }
}

// cree le plugin
async function configPlugin(fastify: FastifyInstance) {
  const config = await loadConfigFromVault();
  fastify.decorate('vault', config);
}

// jsp 
export default fp(configPlugin);