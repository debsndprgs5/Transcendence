

# Variables
IMAGE_NAME = transcendence
PORT       = 3000
WORK_DIR = $(shell pwd)



.PHONY: install clean dev prod docker-build docker-run clear_db

# -------------------------------------------------------------------
# install : install backend + Tailwind + plugin static (v4)
# -------------------------------------------------------------------
install:
	@echo "🔧 Installing dependencies…"
	@touch .env
	@if grep -q '^WORK_DIR=' .env; then \
	  sed -i 's|^WORK_DIR=.*|WORK_DIR=$(WORK_DIR)|' .env; \
	else \
	  echo "WORK_DIR=$(WORK_DIR)" >> .env; \
	fi
	# fastify v4 + plugin static compatible
	npm install fastify@^4 fastify-static@^4
	# Websockets
	npm install ws
	npm install -D @types/ws
	# Types/Ms for dependency
	npm install --save-dev @types/node @types/ms
	# Account (Multipart & sharp for avatar)
	npm install @fastify/multipart sharp
	# le reste (TS, Tailwind, PostCSS…)
	npm install

# -------------------------------------------------------------------
# clean : delete modules & builds
# -------------------------------------------------------------------
clean:
	@echo "🧹 Cleaning…"
	rm -rf node_modules dist client/dist package-lock.json

# -------------------------------------------------------------------
# clear_db : clear the database
# -------------------------------------------------------------------
clear_db:
	@echo "🧹 Erasing & Re-creating database"
	rm -rf src/db/ourdatabase.db
	touch src/db/ourdatabase.db
	rm -rf client/avatars/*



# -------------------------------------------------------------------
# dev : dev-server + watch-css
# -------------------------------------------------------------------
dev: install
	@echo "▶️  Dev mode: starting CSS watch + TS server"
	# 1) watch Tailwind CSS en JIT
	npm run build:css -- --watch &
	# 2) démarrage du serveur en mode dev (ts-node)
	npm run dev

# -------------------------------------------------------------------
# prod : complete build then start
# -------------------------------------------------------------------
prod: install
	@echo "📦 Building for production…"
	# build TS + CSS
	npm run build
	@echo "🚀 Starting production server…"
	npm run start

# -------------------------------------------------------------------
# Docker : build + run
# -------------------------------------------------------------------
docker-build:
	@echo "🐳 Building Docker image '$(IMAGE_NAME)'…"
	docker build -t $(IMAGE_NAME) .

docker-run:
	@echo "🐳 Running Docker container on port $(PORT)…"
	docker run -it --rm -p $(PORT):$(PORT) --name $(IMAGE_NAME) $(IMAGE_NAME)
