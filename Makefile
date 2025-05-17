include .env
export
WORK_DIR = $(shell pwd)

.PHONY: install clean dev prod docker-build docker-run docker-refresh clear_db



all: docker-build  docker-run

docker-build:
	docker build -t $(IMAGE_NAME) .

docker-run:
	@echo "🐳 Running Docker container on port $(SCHOOL_PORT)…"
	docker compose up 
docker-down:
	docker compose down
docker-refresh:
	@docker ps -q --filter "ancestor=$(IMAGE_NAME)" | xargs -r docker stop
	@docker ps -aq --filter "ancestor=$(IMAGE_NAME)" | xargs -r docker rm -v
	@docker images -q $(IMAGE_NAME) | xargs -r docker rmi


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

