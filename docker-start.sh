#!/bin/bash
# MyLeo Chatbot - Docker Quick Start Script for Linux/Mac

echo "========================================"
echo "MyLeo Chatbot - Docker Setup"
echo "========================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker is not installed!"
    echo "Please install Docker from: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "[ERROR] Docker Compose is not installed!"
    echo "Please install Docker Compose"
    exit 1
fi

echo "[OK] Docker is installed"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "[INFO] Creating .env file from template..."
    cp .env.docker.example .env
    echo ""
    echo "[IMPORTANT] Please edit .env file with your configuration!"
    echo "Opening .env file..."
    ${EDITOR:-nano} .env
    echo ""
    read -p "Press Enter after configuring .env to continue..."
fi

echo "[INFO] Starting Docker containers..."
echo ""

# Build and start containers
docker-compose up -d --build

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "[SUCCESS] Containers started!"
    echo "========================================"
    echo ""
    echo "Services running:"
    docker-compose ps
    echo ""
    echo "========================================"
    echo "Access Points:"
    echo "========================================"
    echo "- Application: http://localhost"
    echo "- API Health:  http://localhost/health"
    echo "- Widget:      http://localhost/widget.js"
    echo ""
    echo "========================================"
    echo "Useful Commands:"
    echo "========================================"
    echo "- View logs:    docker-compose logs -f"
    echo "- Stop:         docker-compose stop"
    echo "- Restart:      docker-compose restart"
    echo "- Status:       docker-compose ps"
    echo ""
    echo "See DOCKER_GUIDE.md for more information"
    echo "========================================"
else
    echo ""
    echo "[ERROR] Failed to start containers!"
    echo "Check the error messages above."
    echo ""
    echo "Try:"
    echo "  docker-compose logs"
    echo ""
    exit 1
fi
