############################
# Step 1 : BUILD
############################

# FROM node:18-alpine AS builder

# WORKDIR /app

# # Copy package.json only and lock for cache install

# COPY package*.json ./

# # Install all requirements

# RUN npm install


# # Copy rest of source code

# COPY tsconfig.json ./
# COPY src ./src

# # TypeScript compil

# RUN npm run build


# ############################
# # Step 2 : RUN
# ############################

# FROM node:18-alpine

# # Env var for fastify

# ENV NODE_ENV=production

# # Install sqlite3 CLI tool
# RUN apt-get update && apt-get install -y sqlite3


# WORKDIR /app

# # Copy package.json only to install prod requirements

# COPY package*.json ./

# # Install production requirements only

# RUN npm install --only=production

# # Initialize SQLite database
# RUN sqlite3 src/db/userdata.db < src/db/schema.sql

# # Get back the compiled build from step 1

# COPY --from=builder /app/dist ./dist

# # Expose fastify's port
# EXPOSE 3000

# # Final launch
# CMD ["node", "dist/main.js"]

##FREE GPT SHENANIGANS just here to build sql need a proper dockerarchitecture
############################
# Step 1 : BUILD
############################

FROM node:18-alpine AS builder

WORKDIR /app

# Copy package.json and lock file
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm install

# Copy tsconfig and source
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript -> JavaScript
RUN npm run build


############################
# Step 2 : RUNTIME
############################

FROM node:18-alpine

# Install SQLite CLI & bash
RUN apk add --no-cache sqlite sqlite-dev bash

# Set working directory
WORKDIR /app

# Set environment
ENV NODE_ENV=production

# Copy package files and install production-only deps
COPY package*.json ./
RUN npm install --only=production

#.env package for .ts files
RUN npm install dotenv

# Copy build output from builder stage
COPY --from=builder /app/dist ./dist
COPY .env ./


# Copy DB schema and other needed static files into the proper directory
# Since the app will run in production from dist, copy the DB schema and the DB file into /app/db
  COPY src/db /app/db
#  RUN sqlite3 /app/db/userdata.db < /app/db/schema.sql done in db.ts
# Expose Fastify's port
EXPOSE 3000

# Start the server
CMD ["node", "dist/main.js"]


