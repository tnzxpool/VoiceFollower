@echo off
title VoiceFollower - Server
cd /d H:\VoiceFollower

echo ============================================
echo  VoiceFollower / EdgeMesh - Avvio Server
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERRORE] Node.js non trovato. Installalo da https://nodejs.org (versione LTS^)
    pause
    exit /b 1
)

if not exist node_modules (
    echo Prima installazione delle dipendenze, attendi 1-2 minuti...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo [ERRORE] npm install fallito. Controlla la connessione.
        pause
        exit /b 1
    )
)

echo.
echo Server in avvio su http://localhost:3000
echo (lascia questa finestra aperta; CTRL+C per fermare)
echo.
start "" http://localhost:3000
call npm run dev
pause
