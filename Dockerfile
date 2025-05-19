############################
# Stage 1 : builder-front
############################
FROM node:18-alpine AS builder-front

WORKDIR /app

# Copy Tailwind config and source CSS postcss.config.js
COPY tailwind.config.js  ./
COPY client/src ./client/src
COPY client/index.html ./client/
COPY client/favicon.ico ./client/

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

# Install bash, SQLite, and OpenSSL
RUN apk add --no-cache sqlite sqlite-dev bash openssl

WORKDIR /app

# Copy .env file early to extract env vars
COPY .env ./

# Export env vars from .env, extract HOSTNAME, and generate SSL cert
RUN export $(grep -v '^#' .env | xargs) && \
    HOSTNAME=$(echo "$SESSION_MANAGER" | sed -E 's|.*local/([^.:@]+).*|\1|') && \
    echo "Using CN=$HOSTNAME for self-signed certificate" && \
    mkdir -p cert && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout cert/key.pem -out cert/cert.pem \
      -subj "/C=US/ST=State/L=City/O=AppName/OU=Dev/CN=$HOSTNAME" \
      -addext "subjectAltName=DNS:$HOSTNAME"

# Copy package files and install production dependencies
COPY package*.json ./
RUN apk add --no-cache python3 make g++ \
  && npm install --omit=dev \
  && apk del python3 make g++

# Copy backend build output
COPY --from=builder /app/dist ./dist

# Copy CSS from frontend build
COPY --from=builder-front /app/client/dist ./client/dist

# Copy static files and DB
COPY src/db ./db
COPY client ./client

EXPOSE ${PORT}

CMD ["node", "dist/main.js"]




