#!/bin/bash

echo "Authenticating with Vault..."
# MODIFICATION: Utiliser le bon chemin vers le fichier de secrets
vault login -no-print $(grep VAULT_ROOT_TOKEN /vault/data/.env.vault | cut -d '=' -f2)

echo "Checking if 'kv' secrets engine is enabled..."
if ! vault secrets list | grep -q "kv/"; then
  echo "'kv' secrets engine not found. Enabling it now..."
  vault secrets enable -path=kv -version=2 kv
else
  echo "'kv' secrets engine is already enabled."
fi

echo "Writing secrets to 'kv/transcendence'..."

vault kv put kv/transcendence \
    JWT_SECRET='JnDy&cdiQ*O&NV0vUb*Yve%5#qW3^wPMXWdxQI!P4bC*L6de34' \
    COOKIE_SECRET='&hotzBs@bziCO$oy2xTY0pq7QiBJ9Jz4Clgb$@od0MWzuU*ybL'

echo "Secrets written. Verifying..."
vault kv get kv/transcendence