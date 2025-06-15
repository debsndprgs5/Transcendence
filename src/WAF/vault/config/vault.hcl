// Stockage : où Vault garde ses données chiffrées.
storage "file" {
  path = "/vault/file"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = true
  # tls_cert_file = "/vault/config/tls/vault.crt"
  # tls_key_file  = "/vault/config/tls/vault.key"
}

// Interface utilisateur
ui = true

// Adresse de l'API : comment les autres services doivent contacter Vault
api_addr = "https://vault:8200" 