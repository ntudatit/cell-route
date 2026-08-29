$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env.deploy"
if (-not (Test-Path -LiteralPath $envFile)) {
    throw "Missing .env.deploy. Copy .env.deploy.example and replace every CHANGE_ME value."
}

$content = Get-Content -Raw -LiteralPath $envFile
if ($content -match "CHANGE_ME") {
    throw ".env.deploy still contains CHANGE_ME placeholders."
}

docker compose --env-file $envFile config --quiet
if ($LASTEXITCODE -ne 0) { throw "Docker Compose configuration is invalid." }

Write-Host "Deployment configuration is valid." -ForegroundColor Green
Write-Host "Next: docker compose --env-file .env.deploy up -d --build"
