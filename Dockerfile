############################
# Stage 1 : builder-front
############################
FROM node:18-alpine AS builder-front

WORKDIR /app

# Copie package.json + Tailwind config
COPY package*.json tailwind.config.js postcss.config.js ./

# Installe Tailwind (et autres deps front si besoin)
RUN npm install

# Copie ton CSS source
COPY client/src/input.css ./client/src/

# Build du CSS Tailwind en minifié
RUN npx tailwindcss -i ./client/src/input.css \
    -o ./client/dist/output.css \
    --minify

############################
# Stage 2 : builder-back
############################
FROM node:18-alpine AS builder-back

WORKDIR /app

# Copie package.json + install deps back+dev
COPY package*.json ./
RUN npm install

# Copie le code TS
COPY tsconfig.json ./
COPY src ./src
COPY routes ./routes

# Compile TS → dist/
RUN npm run build

############################
# Stage 3 : runtime
############################
FROM node:18-alpine

WORKDIR /app

# Mode prod
ENV NODE_ENV=production

# Copie les deps prod uniquement
COPY package*.json ./
RUN npm install --only=production

# Copie le back compilé
COPY --from=builder-back /app/dist ./dist

# Copie le CSS buildé + tout client
COPY --from=builder-front /app/client ./client

# Plugin static pour Fastify
RUN npm install @fastify/static

# Ouvre le port
EXPOSE 3000

# Démarrage
CMD ["node", "dist/main.js"]
