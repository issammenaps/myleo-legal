@echo off
REM MyLeo Chatbot - Docker Quick Start Script for Windows

echo ========================================
echo MyLeo Chatbot - Docker Setup
echo ========================================
echo.

REM Check if Docker is installed
where docker >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is not installed!
    echo Please install Docker Desktop from: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

REM Check if docker-compose is installed
where docker-compose >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker Compose is not installed!
    echo Please install Docker Compose
    pause
    exit /b 1
)

echo [OK] Docker is installed
echo.

REM Check if .env file exists
if not exist .env (
    echo [INFO] Creating .env file from template...
    copy .env.docker.example .env
    echo.
    echo [IMPORTANT] Please edit .env file with your configuration!
    echo Press any key to open .env file in notepad...
    pause >nul
    notepad .env
    echo.
    echo After configuring .env, press any key to continue...
    pause >nul
)

echo [INFO] Starting Docker containers...
echo.

REM Build and start containers
docker-compose up -d --build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo [SUCCESS] Containers started!
    echo ========================================
    echo.
    echo Services running:
    docker-compose ps
    echo.
    echo ========================================
    echo Access Points:
    echo ========================================
    echo - Application: http://localhost
    echo - API Health:  http://localhost/health
    echo - Widget:      http://localhost/widget.js
    echo.
    echo ========================================
    echo Useful Commands:
    echo ========================================
    echo - View logs:    docker-compose logs -f
    echo - Stop:         docker-compose stop
    echo - Restart:      docker-compose restart
    echo - Status:       docker-compose ps
    echo.
    echo See DOCKER_GUIDE.md for more information
    echo ========================================
) else (
    echo.
    echo [ERROR] Failed to start containers!
    echo Check the error messages above.
    echo.
    echo Try:
    echo   docker-compose logs
    echo.
)

pause
