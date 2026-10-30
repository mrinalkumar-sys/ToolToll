@echo off
echo ========================================================
echo  ToolToll - AI-Powered Pay-Per-Use API Marketplace
echo ========================================================
echo Starting FastAPI Backend on http://127.0.0.1:8090 ...
start "ToolToll Backend (Port 8090)" cmd /k "uvicorn app.main:app --host 127.0.0.1 --port 8090"

echo Starting Vite React Frontend on http://127.0.0.1:5200 ...
start "ToolToll Frontend (Port 5200)" cmd /k "npm run dev"

echo.
echo Both servers are launching!
echo Frontend: http://127.0.0.1:5200
echo Backend:  http://127.0.0.1:8090/docs
echo ========================================================
pause
