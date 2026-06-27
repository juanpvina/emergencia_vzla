param(
    [switch]$NoInstall
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# Frontend deps
$frontendNodeModules = Join-Path $root "frontend\node_modules"
if (!(Test-Path $frontendNodeModules)) {
    Write-Host "[setup] Instalando dependencias del frontend..." -ForegroundColor Yellow
    Push-Location (Join-Path $root "frontend")
    npm install
    Pop-Location
}

# Backend venv
$venvPath = Join-Path $root "backend\.venv"
if (!(Test-Path $venvPath)) {
    Write-Host "[setup] Creando venv e instalando dependencias del backend..." -ForegroundColor Yellow
    Push-Location (Join-Path $root "backend")
    python -m venv .venv
    &.\.venv\Scripts\pip install -r requirements.txt -q
    Pop-Location
}

Write-Host "[start] Iniciando API y frontend..." -ForegroundColor Green

# Start backend with venv activation
$backendJob = Start-Job -ScriptBlock {
    $root = $args[0]
    $venvActivate = Join-Path $root "backend\.venv\Scripts\Activate.ps1"
    Push-Location (Join-Path $root "backend")
    &. $venvActivate
    uvicorn app.main:app --reload --port 8000
    Pop-Location
} -ArgumentList $root

# Start frontend
$frontendJob = Start-Job -ScriptBlock {
    $root = $args[0]
    Push-Location (Join-Path $root "frontend")
    npm run dev
    Pop-Location
} -ArgumentList $root

Write-Host "  API:      http://localhost:8000" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Docs:     http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "Presiona Ctrl+C para detener ambos servicios" -ForegroundColor Gray

# Show output from both jobs
try {
    while ($backendJob.State -eq "Running" -or $frontendJob.State -eq "Running") {
        Receive-Job $backendJob -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "[api] $_" -ForegroundColor Blue }
        Receive-Job $frontendJob -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "[web] $_" -ForegroundColor Green }
        Start-Sleep -Milliseconds 500
    }
}
finally {
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $frontendJob -ErrorAction SilentlyContinue
}
