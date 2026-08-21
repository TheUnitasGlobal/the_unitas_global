[CmdletBinding()]
param(
    [string]$EnvFile = '.env',
    [string]$ProjectRef = $env:SUPABASE_PROJECT_REF
)

$ErrorActionPreference = 'Stop'

function Invoke-Supabase {
    if (Get-Command supabase -ErrorAction SilentlyContinue) {
        & supabase @args
    } elseif (Test-Path 'node_modules/.bin/supabase.cmd') {
        & npx --no-install supabase @args
    } else {
        throw 'Supabase CLI is not installed. Run npm install and npm run setup:tools.'
    }
    if ($LASTEXITCODE -ne 0) { throw "Supabase CLI command failed with exit code $LASTEXITCODE." }
}

if (-not (Test-Path $EnvFile)) { throw "Environment file '$EnvFile' was not found." }
if ([string]::IsNullOrWhiteSpace($ProjectRef)) { throw 'SUPABASE_PROJECT_REF is required.' }
if ([string]::IsNullOrWhiteSpace($env:SUPABASE_ACCESS_TOKEN)) {
    throw 'SUPABASE_ACCESS_TOKEN is required. Authenticate with the Supabase CLI or set the token.'
}

Invoke-Supabase link --project-ref $ProjectRef

$secretNames = @(
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SITE_URL',
    'PRICE_ID_ARCHE',
    'PRICE_ID_ARENA',
    'PRICE_ID_SCORE',
    'PRICE_ID_FATE',
    'PRICE_ID_CODEX22'
)
$envValues = @{}
Get-Content $EnvFile | Where-Object { $_ -match '^\s*([^#][^=]*)=(.*)$' } | ForEach-Object {
    $envValues[$Matches[1].Trim()] = $Matches[2].Trim()
}

foreach ($name in $secretNames) {
    $value = $envValues[$name]
    if ([string]::IsNullOrWhiteSpace($value) -or $value -match '<') {
        throw "$name is missing or still contains a placeholder in $EnvFile."
    }
    Invoke-Supabase secrets set "$name=$value"
}

Invoke-Supabase functions deploy create-checkout-session
Invoke-Supabase functions deploy stripe-webhook

Write-Host "Supabase functions deployed for project $ProjectRef."
