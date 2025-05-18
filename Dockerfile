############################
# Stage 1 : builder-front
############################
FROM node:18-alpine AS builder-front

WORKDIR /app

# Copy Tailwind config and source CSS postcss.config.js
COPY tailwind.config.js  ./
COPY client/src ./client/src

# Install Tailwind and dependencies
COPY package*.json ./
RUN npm install

# Build Tailwind CSS
RUN npx tailwindcss -i ./client/src/input.css \
    -o ./client/dist/output.css \
    --minify

############################
# Stage 2 : builder
############################
FROM node:18-alpine AS builder

WORKDIR /app

# Copy and install all dependencies (for TS and tools)
COPY package*.json ./
RUN npm install

# Copy full source for TS build
COPY tsconfig.json ./
COPY src ./src
COPY client ./client

# Build the backend (TS -> JS)
RUN npm run build

############################
# Stage 3 : runtime
############################
FROM node:18-alpine

# Install bash and SQLite (for dev or debugging if needed)
RUN apk add --no-cache sqlite sqlite-dev bash

WORKDIR /app

# Install production deps
COPY package*.json ./
# Alpine-based
RUN apk add --no-cache python3 make g++ \
  && npm install --omit=dev \
  && apk del python3 make g++


# Copy backend build output
COPY --from=builder /app/dist ./dist

# Copy CSS from frontend build
COPY --from=builder-front /app/client/dist ./client/dist

# Copy static files and DB
COPY .env ./       
COPY src/db ./db    
COPY client ./client

EXPOSE ${PORT}

CMD ["node", "dist/main.js"]



