# Start Phase 1 infrastructure (Postgres, Redis, MinIO)
# Requires Docker Desktop.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host "Docker is not installed or not on PATH." -ForegroundColor Red
  Write-Host "Install Docker Desktop, then re-run this script."
  exit 1
}

Set-Location $root

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example"
}

docker compose -f deploy/compose/docker-compose.yml up -d
docker compose -f deploy/compose/docker-compose.yml ps
