@echo off
REM Test raggiungibilita' nodo GPU 192.168.1.88 - scrive il risultato in test_88_result.txt
setlocal
set OUT=%~dp0test_88_result.txt

echo === TEST 192.168.1.88 - %date% %time% === > "%OUT%"

echo. >> "%OUT%"
echo --- PING --- >> "%OUT%"
ping -n 2 -w 1500 192.168.1.88 >> "%OUT%" 2>&1

echo. >> "%OUT%"
echo --- OLLAMA /api/tags (porta 11434) --- >> "%OUT%"
curl.exe -s --max-time 8 http://192.168.1.88:11434/api/tags >> "%OUT%" 2>&1
if errorlevel 1 echo [ERRORE] Ollama non raggiungibile su 11434 >> "%OUT%"

echo. >> "%OUT%"
echo --- OLLAMA /api/version --- >> "%OUT%"
curl.exe -s --max-time 5 http://192.168.1.88:11434/api/version >> "%OUT%" 2>&1

echo. >> "%OUT%"
echo --- R740 AI FACTORY /healthz (porta 8080) --- >> "%OUT%"
curl.exe -s --max-time 5 http://192.168.1.88:8080/healthz >> "%OUT%" 2>&1
if errorlevel 1 echo [ERRORE] Factory non raggiungibile su 8080 >> "%OUT%"

echo. >> "%OUT%"
echo --- R740 AI FACTORY /api/v1/info --- >> "%OUT%"
curl.exe -s --max-time 5 http://192.168.1.88:8080/api/v1/info >> "%OUT%" 2>&1

echo. >> "%OUT%"
echo --- R740 AI FACTORY /api/v1/models --- >> "%OUT%"
curl.exe -s --max-time 5 http://192.168.1.88:8080/api/v1/models >> "%OUT%" 2>&1

echo. >> "%OUT%"
echo --- R740 AI FACTORY portale (porta 8081) --- >> "%OUT%"
curl.exe -s --max-time 5 -o NUL -w "HTTP %%{http_code}" http://192.168.1.88:8081/ >> "%OUT%" 2>&1

echo. >> "%OUT%"
echo --- APP VoiceFollower /api/health (porta 3000) --- >> "%OUT%"
curl.exe -s --max-time 5 http://192.168.1.88:3000/api/health >> "%OUT%" 2>&1
if errorlevel 1 echo [ERRORE] App non attiva su 3000 >> "%OUT%"

echo. >> "%OUT%"
echo === FINE TEST === >> "%OUT%"

echo.
echo Risultato salvato in: %OUT%
echo.
type "%OUT%"
pause
