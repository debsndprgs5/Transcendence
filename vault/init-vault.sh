#!/bin/bash

# Fichier où les clés seront stockées
VAULT_KEYS_FILE=".vault-keys"

# Attendre que Vault soit prêt
echo "Waiting for Vault to be ready..."
while ! nc -z vault 8200; do
  sleep 1
done
echo "Vault is up!"

# Vérifier si Vault est déjà initialisé
if vault status -format=json | grep -q '"initialized": true'; then
    echo "Vault is already initialized."
else
    echo "Vault is not initialized. Initializing..."
    # Initialiser Vault et sauvegarder la sortie
    vault operator init -key-shares=1 -key-threshold=1 > $VAULT_KEYS_FILE

    # Extraire les clés et le token
    UNSEAL_KEY=$(grep 'Unseal Key 1:' $VAULT_KEYS_FILE | awk '{print $NF}')
    ROOT_TOKEN=$(grep 'Initial Root Token:' $VAULT_KEYS_FILE | awk '{print $NF}')

    # Ajouter au fichier .env pour que d'autres services puissent l'utiliser
    echo "VAULT_UNSEAL_KEY=$UNSEAL_KEY" > .env.vault
    echo "VAULT_ROOT_TOKEN=$ROOT_TOKEN" >> .env.vault
    echo "Vault keys and token stored in .env.vault"
fi

# Charger les variables depuis .env.vault si le fichier existe
if [ -f ".env.vault" ]; then
    export $(grep -v '^#' .env.vault | xargs)
fi

# Désceller Vault
echo "Unsealing Vault..."
vault operator unseal $VAULT_UNSEAL_KEY

echo "Vault setup complete. go to http://localhost:8200/"
