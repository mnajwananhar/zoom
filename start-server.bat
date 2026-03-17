@echo off
echo ==========================================
echo  Petshop Zoom Admin - SQLite Backend
echo ==========================================
echo.

if not exist "backend\node_modules" (
    echo Installing dependencies...
    cd backend
    call npm install
    cd ..
) else (
    echo Dependencies already installed.
)

if not exist "backend\data\petshop.db" (
    echo Initializing database...
    cd backend
    node src/init-db.js
    cd ..
) else (
    echo Database already exists.
)

echo.
echo Starting server...
cd backend
npm start
