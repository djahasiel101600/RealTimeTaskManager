param(
    [string]$venvPath = '.venv'
)

# Run this from repo root (PowerShell)
Write-Host "Activating virtualenv and starting backend (Daphne recommended for Channels)"
if (-Not (Test-Path $venvPath)) {
    Write-Host "Creating virtualenv at $venvPath" -ForegroundColor Yellow
    python -m venv $venvPath
}

. "$venvPath\Scripts\Activate.ps1"
Write-Host "Installing requirements (if needed)"
pip install -r backend/requirements.txt

Write-Host "Apply migrations and collect static files"
cd backend
python manage.py migrate
python manage.py collectstatic --noinput

Write-Host "Starting Daphne on port 8000"
daphne -b 0.0.0.0 -p 8000 task_manager.asgi:application
