
# Variables
IMAGE_NAME = transcendence
PORT       = 3000

.PHONY: all install dev build start docker-build docker-run clean

all: install build

deploy:
	sudo ufw reload

install:
	@echo "Installing dependencies..."
	npm install
	# Auth + JWT + 2FA requirements
	npm install bcrypt jsonwebtoken speakeasy 
	npm install -D @types/bcrypt @types/jsonwebtoken #
	npm install --save-dev @types/speakeasy
# Run in development (TS live via ts-node or nodemon)
dev:
	@echo "Starting development server..."
	npm run dev

# Compile TypeScript to JavaScript
build:
	@echo "Building project..."
	npm run build

# Run the built app
start:
	@echo "Starting production server..."
	npm run start

# Docker: build the container image
docker-build:
	@echo "Building Docker image '$(IMAGE_NAME)'..."
	docker build -t $(IMAGE_NAME) .

# Docker: run the container
docker-run:
	@echo "Running Docker container on port $(PORT)..."
	docker run -it --rm -p $(PORT):$(PORT) --name $(IMAGE_NAME) $(IMAGE_NAME)

# Clean local artifacts
clean:
	@echo "Cleaning up node_modules and dist..."
	rm -rf node_modules dist
	rm -rf package-lock.json
