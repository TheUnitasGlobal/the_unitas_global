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

# --------------------------------------------------------------------------
# Placeholder detection (Codex ch.13 fail-closed).
#
# THIS FILE WAS THE ONLY PLACEHOLDER CHECK IN THE REPOSITORY, AND IT LOOKED
# FOR '<' ALONE. On 2026-09-17 the nightly archive daemon died on
# `REST 401: Invalid API key`: `vercel env pull` does not decrypt
# Secret-typed variables, it writes the literal 11-character string
# '[SENSITIVE]' -- which contains no '<' and sailed through every guard here.
#
# The rules below mirror PLACEHOLDER_RULES in web/scripts/credential-core.mjs
# and web/lib/security/credentialShape.ts, rule for rule. Presence is not
# validity.
# --------------------------------------------------------------------------
function Test-UnitasPlaceholder {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return $true }
    $v = $Value.Trim()
    if ($v -eq '[SENSITIVE]') { return $true }              # vercel env pull, Secret type
    if ($v -like '*<*' -or $v -like '*>*') { return $true }  # .env.example <paste-the-...>
    if ($v -match '^(?i)(your[_-]|changeme|todo|replace[_-]?me|xxx+$)') { return $true }
    return $false
}

# Never prints the value -- only its length -- so a throw is safe in any log.
function Get-UnitasCredentialShape {
    param([string]$Value)
    $v = $Value.Trim()
    if ($v.Length -eq 0) { return '(empty)' }
    return "($($v.Length) chars)"
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
if (Test-UnitasPlaceholder $ProjectRef) {
    throw "SUPABASE_PROJECT_REF is missing or still a placeholder $(Get-UnitasCredentialShape $ProjectRef). Set it in $EnvFile, export it as an environment variable, or pass -ProjectRef."
}
if ($ProjectRef -cnotmatch '^[a-z]{20}$') {
    throw "SUPABASE_PROJECT_REF does not look like a Supabase project ref (20 lowercase letters) $(Get-UnitasCredentialShape $ProjectRef)."
}

if ([string]::IsNullOrWhiteSpace($env:SUPABASE_ACCESS_TOKEN)) {
    $env:SUPABASE_ACCESS_TOKEN = $envValues['SUPABASE_ACCESS_TOKEN']
}
if (Test-UnitasPlaceholder $env:SUPABASE_ACCESS_TOKEN) {
    throw "SUPABASE_ACCESS_TOKEN is missing or still a placeholder $(Get-UnitasCredentialShape $env:SUPABASE_ACCESS_TOKEN). Set it in $EnvFile or export it as an environment variable (generate one at https://supabase.com/dashboard/account/tokens)."
}
if ($env:SUPABASE_ACCESS_TOKEN -cnotmatch '^sbp_') {
    throw "SUPABASE_ACCESS_TOKEN is not a Supabase personal access token (expected an sbp_ prefix) $(Get-UnitasCredentialShape $env:SUPABASE_ACCESS_TOKEN)."
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
    if (Test-UnitasPlaceholder $value) {
        throw "$name is missing or still contains a placeholder in $EnvFile $(Get-UnitasCredentialShape $value)."
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
