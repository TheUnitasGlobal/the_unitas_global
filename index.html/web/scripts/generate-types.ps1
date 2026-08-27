# Generates lib/supabase/database.types.ts from the live Supabase schema.
# Reuses the same project as the root static site's coin-core system --
# pass -ProjectRef explicitly, or set SUPABASE_PROJECT_REF in your
# environment / .env (see ..\..\SUPABASE_PROJECT_REF usage in the root repo).

param(
  [string]$ProjectRef = $env:SUPABASE_PROJECT_REF
)

$ErrorActionPreference = "Stop"

if (-not $ProjectRef) {
  Write-Error "SUPABASE_PROJECT_REF is not set. Set it in .env or pass -ProjectRef <ref>."
  exit 1
}

$outDir = Join-Path $PSScriptRoot "..\lib\supabase"
if (-not (Test-Path $outDir)) {
  New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$outFile = Join-Path $outDir "database.types.ts"
Write-Host "Generating Supabase types for project '$ProjectRef' -> $outFile"

npx supabase gen types typescript --project-id $ProjectRef --schema public | Out-File -Encoding utf8 $outFile

if ($LASTEXITCODE -ne 0) {
  Write-Error "supabase gen types failed (exit $LASTEXITCODE)."
  exit $LASTEXITCODE
}

Write-Host "Done: $outFile"
