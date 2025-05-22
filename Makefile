
# Variables
WORK_DIR = $(shell pwd)
SHELL := /bin/bash
.PHONY: install clean dev prod docker-build docker-run clear_db



# -------------------------------------------------------------------
# Env maniplutation to get login and hostMachine(ex:C1R2P8)
# -------------------------------------------------------------------
set-env:
	@if grep -q '^PORT=' .env; then \
	  sed -i 's|^PORT=.*|PORT=$(PORT)|' .env; \
	else \
	  echo "PORT=$(PORT)" >> .env; \
	fi
myexport-env:
	@mkdir -p /goinfre/${USER}/transcendence
	@for VAR in USER SESSION_MANAGER; do \
	  if printenv $$VAR >/dev/null; then \
	    if grep -q "^$$VAR=" .env; then \
	      sed -i "s|^$$VAR=.*|$$VAR=$${!VAR}|" .env; \
	    else \
	      echo "$$VAR=$${!VAR}" >> .env; \
	    fi; \
	  fi; \
	done


# -------------------------------------------------------------------
# Docker Rules
# -------------------------------------------------------------------
docker-up:myexport-env
	@if grep -q '^WORK_DIR=' .env; then \
	  sed -i 's|^WORK_DIR=.*|WORK_DIR=$(WORK_DIR)|' .env; \
	else \
	  echo "WORK_DIR=$(WORK_DIR)" >> .env; \
	fi
	@$(MAKE) set-env PORT=1400
	mkdir -p client/dist
	mkdir -p client/avatars
	@docker compose build --no-cache
	@docker compose up

docker-down:
	@docker compose down

docker-refresh: docker-down
	@docker ps -q --filter "ancestor=$(IMAGE_NAME)" | xargs -r docker stop
	@docker ps -aq --filter "ancestor=$(IMAGE_NAME)" | xargs -r docker rm -v
	@docker images -q $(IMAGE_NAME) | xargs -r docker rmi
	@ make docker-up

docker-build:
	@echo "🐳 Building Docker image '$(IMAGE_NAME)'…"
	docker build -t $(IMAGE_NAME) .

docker-run:
	@echo "🐳 Running Docker container on port $(PORT)…"
	docker run -it --rm -p $(PORT):$(PORT) --name $(IMAGE_NAME) $(IMAGE_NAME)


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
	@$(MAKE) set-env PORT=3000
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
	@rm -rf node_modules package-lock.json
	@docker compose down
	@docker ps -q --filter "ancestor=$(IMAGE_NAME)" | xargs -r docker stop
	@docker ps -aq --filter "ancestor=$(IMAGE_NAME)" | xargs -r docker rm -v
	@docker images -q $(IMAGE_NAME) | xargs -r docker rmi

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

