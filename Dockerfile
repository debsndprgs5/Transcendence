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

# Install specific dependencies 
RUN npm install fastify@^4 fastify-static@^4 \
    && npm install ws @types/ws \
    && npm install @fastify/multipart sharp \
    && npm install


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

RUN apk add --no-cache sqlite sqlite-dev bash python3 make g++ && \
    ln -sf python3 /usr/bin/python

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist
COPY src/db /app/db
COPY client /app/client

COPY --from=builder-front /app/client/dist/output.css /app/client/dist/
# COPY client/app.js /app/client/
 COPY client/index.html /app/client/

EXPOSE ${SCHOOL_PORT}

CMD ["node", "dist/main.js"]
