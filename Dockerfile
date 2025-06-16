############################
# Stage 1 : builder-front
############################
FROM node:18-alpine AS builder-front

WORKDIR /app

# 1) install dependencies for TS client and babylon
COPY package*.json tsconfig.client.json ./
RUN npm install --prefer-offline --no-audit --progress=false

# 2) copy the front
COPY client ./client
COPY shared ./client/src/shared
COPY tailwind.config.js ./

# 3) build CSS + JS client
RUN npx tailwindcss -i client/src/input.css -o client/dist/output.css --minify
RUN npm run build:client
RUN npm run bundle

############################
# Stage 2 : builder-back
############################
FROM node:18-alpine AS builder-back

WORKDIR /app

# 1) install dependencies for server
COPY package*.json ./
RUN apk add --no-cache python3 make g++ \
 && ln -sf python3 /usr/bin/python \
#  && npm install \
 && npm install --prefer-offline --no-audit --progress=false \
 && apk del python3 make g++

# 2) copy backend TS + dist client from builder-front
COPY --from=builder-front /app/client ./client

# Copy tsconfig and server-source
COPY tsconfig.json ./
COPY src ./src
COPY shared ./src/shared
# 3) compile back-end
RUN npx tsc -p tsconfig.json

############################
# Stage 3 : runtime
############################
FROM node:18-alpine

WORKDIR /app

# install sqlite, bash, openssl
RUN apk add --no-cache sqlite sqlite-dev bash openssl

# 1) copy .env & cert gen
COPY .env ./
RUN export $(grep -v '^#' .env | xargs) && \
    HOSTNAME=$(echo "$SESSION_MANAGER" | sed -E 's|.*local/([^.:@]+).*|\1|') && \
    mkdir cert && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout cert/key.pem -out cert/cert.pem \
      -subj "/C=US/ST=State/L=City/O=AppName/OU=Dev/CN=$HOSTNAME" \
      -addext "subjectAltName=DNS:$HOSTNAME"

# 2) copy node_modules + build back + client dist + static front
COPY --from=builder-back /app/node_modules ./node_modules
COPY --from=builder-back /app/dist ./dist
COPY --from=builder-back /app/client ./client

# 3) copy DB
COPY src/db ./db
COPY shared ./src/shared

# a  decommenter si vous voulez tester sans le WAF
#EXPOSE ${PORT}      

CMD ["node", "dist/main.js"]
