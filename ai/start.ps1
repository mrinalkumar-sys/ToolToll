# PowerShell Startup Script for ToolToll AI Service
$env:PYTHONPATH = $PSScriptRoot
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Starting ToolToll AI Service on http://127.0.0.1:8001" -ForegroundColor Green
Write-Host "  Swagger UI Docs: http://127.0.0.1:8001/docs" -ForegroundColor Yellow
Write-Host "  Health Status:   http://127.0.0.1:8001/health" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
