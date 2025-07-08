#!/bin/bash

set -e # Arrête le script si une commande échoue

echo "Waiting for Vault to be ready..."
while ! nc -z vault 8200; do
  sleep 1
done
echo "Vault is up!"

# vault status -format=json
if [ ! -f ".env.vault" ]; then
    echo "No .env.vault file found. Initializing new Vault instance..."

    if vault status -format=json | grep -q '"initialized": true'; then
        echo "ERROR: Vault is already initialized, but .env.vault is missing."
        echo "Please run make clean"
        exit 1
    fi

    INIT_DATA=$(vault operator init -key-shares=1 -key-threshold=1 -format=json)
    UNSEAL_KEY=$(echo "$INIT_DATA" | jq -r '.unseal_keys_b64[0]')
    ROOT_TOKEN=$(echo "$INIT_DATA" | jq -r '.root_token')

    echo "VAULT_UNSEAL_KEY=$UNSEAL_KEY" > .env.vault
    echo "VAULT_ROOT_TOKEN=$ROOT_TOKEN" >> .env.vault
    echo "New .env.vault file created."
fi

echo "Loading keys from .env.vault..."
set -a 
source .env.vault
set +a

if [ -z "$VAULT_UNSEAL_KEY" ]; then
    echo "ERROR: VAULT_UNSEAL_KEY is not set. Cannot unseal."
    exit 1
fi

echo "Unsealing Vault..."
vault operator unseal $VAULT_UNSEAL_KEY

echo "Vault setup complete. go to http://localhost:8200/"
