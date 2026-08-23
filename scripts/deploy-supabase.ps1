[CmdletBinding()]
param(
    [string]$EnvFile = '.env',
    [string]$ProjectRef,
    [switch]$SkipDbPush
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

# Load .env first so SUPABASE_PROJECT_REF / SUPABASE_ACCESS_TOKEN can fall back
# to it below -- neither the -ProjectRef param nor $env:SUPABASE_ACCESS_TOKEN
# read the .env file on their own.
$envValues = @{}
Get-Content $EnvFile | Where-Object { $_ -match '^\s*([^#][^=]*)=(.*)$' } | ForEach-Object {
    $envValues[$Matches[1].Trim()] = $Matches[2].Trim()
}

if ([string]::IsNullOrWhiteSpace($ProjectRef)) { $ProjectRef = $env:SUPABASE_PROJECT_REF }
if ([string]::IsNullOrWhiteSpace($ProjectRef)) { $ProjectRef = $envValues['SUPABASE_PROJECT_REF'] }
if ([string]::IsNullOrWhiteSpace($ProjectRef) -or $ProjectRef -match '<') {
    throw "SUPABASE_PROJECT_REF is required. Set it in $EnvFile, export it as an environment variable, or pass -ProjectRef."
}

if ([string]::IsNullOrWhiteSpace($env:SUPABASE_ACCESS_TOKEN)) {
    $env:SUPABASE_ACCESS_TOKEN = $envValues['SUPABASE_ACCESS_TOKEN']
}
if ([string]::IsNullOrWhiteSpace($env:SUPABASE_ACCESS_TOKEN) -or $env:SUPABASE_ACCESS_TOKEN -match '<') {
    throw "SUPABASE_ACCESS_TOKEN is required. Set it in $EnvFile or export it as an environment variable (generate one at https://supabase.com/dashboard/account/tokens)."
}

# Persists supabase/.temp/project-ref, which is what `supabase db push` (and
# other linked commands) actually reads on subsequent runs -- not .env.
Invoke-Supabase link --project-ref $ProjectRef

$secretNames = @(
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SITE_URL',
    'PRICE_ID_COIN_SMALL',
    'PRICE_ID_COIN_MEDIUM',
    'PRICE_ID_COIN_LARGE',
    # Deprecated (Rev 0 coin-core) -- still set because create-checkout-session
    # is left live/dormant, not deleted. See THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md.
    'PRICE_ID_ARCHE',
    'PRICE_ID_ARENA',
    'PRICE_ID_SCORE',
    'PRICE_ID_FATE',
    'PRICE_ID_CODEX22'
)

foreach ($name in $secretNames) {
    $value = $envValues[$name]
    if ([string]::IsNullOrWhiteSpace($value) -or $value -match '<') {
        throw "$name is missing or still contains a placeholder in $EnvFile."
    }
    Invoke-Supabase secrets set "$name=$value"
}

Invoke-Supabase functions deploy create-checkout-session
Invoke-Supabase functions deploy create-coin-checkout-session
Invoke-Supabase functions deploy stripe-webhook

if (-not $SkipDbPush) {
    Invoke-Supabase db push
}

Write-Host "Supabase functions$(if (-not $SkipDbPush) { ' and migrations' }) deployed for project $ProjectRef."
