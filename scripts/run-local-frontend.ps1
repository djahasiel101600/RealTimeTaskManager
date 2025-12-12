param(
    [string]$npmCmd = 'npm'
)

Write-Host "Starting frontend dev server"
cd frontend
if (-Not (Test-Path 'node_modules')) {
    Write-Host "Installing dependencies..."
    & $npmCmd install
}
& $npmCmd run dev
