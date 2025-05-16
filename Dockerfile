############################
# Stage 1 : builder-front
############################
FROM node:18-alpine AS builder-front

WORKDIR /app

# Copy package files and configs
COPY package*.json tailwind.config.js ./

# Install dependencies
RUN npm install

# Copy client directory
COPY client ./client

# Build Tailwind CSS
RUN npx tailwindcss -i ./client/src/input.css \
    -o ./client/dist/output.css \
    --minify

############################
# Stage 2 : builder-back
############################
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm install

# Copy configs and source
COPY tsconfig.json ./
COPY src ./src
COPY client ./client
# Build TypeScript
RUN npm run build

############################
# Stage 3 : RUNTIME
############################
FROM node:18-alpine

# Set runtime metadata with current time and user
#LABEL build.date="2025-05-16 19:53:56"
#LABEL build.user="ysebban"

# Install SQLite CLI and runtime build tools
RUN apk add --no-cache sqlite sqlite-dev bash python3 make g++ && \
    ln -sf python3 /usr/bin/python

WORKDIR /app

ENV NODE_ENV=production

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy built backend (JS) from builder
COPY --from=builder /app/dist ./dist

# Copy .env if needed
COPY .env ./

# Copy DB schema and data files
COPY src/db /app/db

# First, create the client directory structure
RUN mkdir -p /app/client/dist

# Copy built frontend assets (compiled CSS) from builder-front
COPY --from=builder-front /app/client/dist/output.css /app/client/dist/

# Copy only necessary static frontend files, specifically excluding src directory
COPY client/index.html /app/client/
#COPY client/assets /app/client/assets

# Expose backend port
EXPOSE 1400

# Start your server
CMD ["node", "dist/main.js"]


