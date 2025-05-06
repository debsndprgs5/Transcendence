############################
# Step 1 : BUILD
############################

FROM node:18-alpine AS builder

WORKDIR /app

# Copy package.json only and lock for cache install

COPY package*.json ./

# Install all requirements

RUN npm install

# Copy rest of source code

COPY tsconfig.json ./
COPY src ./src

# TypeScript compil

RUN npm run build


############################
# Step 2 : RUN
############################

FROM node:18-alpine

# Env var for fastify

ENV NODE_ENV=production


WORKDIR /app

# Copy package.json only to install prod requirements

COPY package*.json ./

# Install production requirements only

RUN npm install --only=production

# Get back the compiled build from step 1

COPY --from=builder /app/dist ./dist

# Expose fastify's port
EXPOSE 3000

# Final launch
CMD ["node", "dist/main.js"]
