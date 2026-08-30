# Launches the Next.js dev server, the local Supabase stack, and the root
# repo's Stripe webhook mock listener together, so `.\scripts\dev-all.ps1`
# from web/ (or the VS Code "Launch All" task) brings up the whole local
# environment in one shot. Ctrl+C stops all three.

$ErrorActionPreference = "Stop"

$webRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $webRoot

Write-Host "[dev-all] Starting Supabase local stack..."
$supabaseJob = Start-Job -Name "unitas-supabase" -ScriptBlock {
  param($cwd)
  Set-Location $cwd
  npx supabase start
} -ArgumentList $repoRoot

Write-Host "[dev-all] Starting Stripe webhook mock listener (root repo)..."
$webhookJob = Start-Job -Name "unitas-webhook" -ScriptBlock {
  param($cwd)
  Set-Location $cwd
  npm run mock:checkout
} -ArgumentList $repoRoot

try {
  Set-Location $webRoot
  Write-Host "[dev-all] Opening the LAN bridge for same-Wi-Fi mobile testing..."
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "lan-bridge.ps1")
  Write-Host "[dev-all] Starting Next.js dev server (foreground, bound to 0.0.0.0 -- reachable at http://localhost:3000 and the LAN URL printed above)..."
  npm run dev
}
finally {
  Write-Host "[dev-all] Stopping background jobs..."
  Stop-Job $supabaseJob, $webhookJob -ErrorAction SilentlyContinue | Out-Null
  Receive-Job $supabaseJob -ErrorAction SilentlyContinue
  Receive-Job $webhookJob -ErrorAction SilentlyContinue
  Remove-Job $supabaseJob, $webhookJob -ErrorAction SilentlyContinue
}
