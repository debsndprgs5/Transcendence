#!/bin/bash

set -e

echo "Waiting for Vault to be ready..."
while ! nc -z vault 8200; do
  sleep 1
done
echo "Vault is up!"

# if [ -d "/vault/data/.env.vault" ]; then
#     echo "CRITICAL WARNING: .env.vault was a directory. Forcing removal."
#     rm -rf "/vault/data/.env.vault"
# fi
# ptet ca sert a qq chose on sait pas

if vault status -format=json | grep -q '"initialized": false'; then
    echo "Vault not initialized. Initializing and creating .env.vault..."
    INIT_DATA=$(vault operator init -key-shares=1 -key-threshold=1 -format=json)
    UNSEAL_KEY=$(echo "$INIT_DATA" | jq -r '.unseal_keys_b64[0]')
    ROOT_TOKEN=$(echo "$INIT_DATA" | jq -r '.root_token')

    echo "VAULT_UNSEAL_KEY=$UNSEAL_KEY" > /vault/data/.env.vault
    echo "VAULT_ROOT_TOKEN=$ROOT_TOKEN" >> /vault/data/.env.vault
    echo "New .env.vault file created."
else
    echo "Vault already initialized. Assuming .env.vault exists and is correct."
fi

echo "Loading keys from /vault/data/.env.vault..."
if [ ! -f "/vault/data/.env.vault" ] || [ ! -s "/vault/data/.env.vault" ]; then
    echo "FATAL: .env.vault is missing or empty after initialization check. Please run 'make clean' and try again."
    exit 1
fi
set -a 
source /vault/data/.env.vault
set +a

if [ -z "$VAULT_UNSEAL_KEY" ]; then
    echo "ERROR: VAULT_UNSEAL_KEY is not set in .env.vault. Cannot unseal."
    exit 1
fi

echo "Unsealing Vault..."
vault operator unseal $VAULT_UNSEAL_KEY

echo "Vault setup complete."
