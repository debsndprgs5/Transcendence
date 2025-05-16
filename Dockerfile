############################
# Stage 1 : builder-front
############################
FROM node:18-alpine AS builder-front

WORKDIR /app

# Copie package.json + Tailwind config
COPY package*.json tailwind.config.js postcss.config.js ./

RUN npm install

# Copy frontend source code
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

# Copy package.json and lock file
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm install

# Copy tsconfig and backend source
COPY tsconfig.json ./
COPY src ./src

# Also copy client so that the backend can serve built assets if necessary
COPY client ./client

# Build TypeScript -> JavaScript
RUN npm run build


############################
# Stage 3 : RUNTIME
############################

FROM node:18-alpine

# Install SQLite CLI and runtime build tools
RUN apk add --no-cache sqlite sqlite-dev bash python3 make g++ && \
    ln -sf python3 /usr/bin/python

WORKDIR /app

ENV NODE_ENV=production

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm install --only=production

# If dotenv is a prod dependency, add it to your package.json under "dependencies".
# Otherwise, install it here for runtime only:
# RUN npm install dotenv

# Copy built backend (JS) from builder
COPY --from=builder /app/dist ./dist

# Copy .env if needed
COPY .env ./

# Copy DB schema and data files
COPY src/db /app/db

# Copy built frontend assets from builder-front to public directory
COPY --from=builder-front /app/client/dist /app/public

# Copy any other static frontend files (e.g., index.html, favicon) if needed
COPY client/ /app/public

# Expose backend port
EXPOSE 1400

# Start your server
CMD ["node", "dist/main.js"]


