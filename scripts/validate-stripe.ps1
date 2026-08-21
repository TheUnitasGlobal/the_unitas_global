[CmdletBinding()]
param(
    [string]$EnvFile = '.env'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $EnvFile)) {
    throw "Environment file '$EnvFile' was not found. Copy .env.example to .env first."
}

Get-Content $EnvFile | Where-Object { $_ -match '^\s*[^#][^=]*=' } | ForEach-Object {
    $name, $value = $_ -split '=', 2
    if (-not [Environment]::GetEnvironmentVariable($name.Trim())) {
        [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim())
    }
}

$secret = $env:STRIPE_SECRET_KEY
if ([string]::IsNullOrWhiteSpace($secret) -or $secret -match '<set-|<') {
    throw 'STRIPE_SECRET_KEY is missing or still contains a placeholder.'
}

$priceNames = @('PRICE_ID_ARCHE', 'PRICE_ID_ARENA', 'PRICE_ID_SCORE', 'PRICE_ID_FATE', 'PRICE_ID_CODEX22')
$headers = @{ Authorization = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($secret + ':')) }

foreach ($name in $priceNames) {
    $priceId = [Environment]::GetEnvironmentVariable($name)
    if ($priceId -notmatch '^price_[A-Za-z0-9]+$') {
        throw "$name is missing or is not a valid Stripe Price ID."
    }

    $price = Invoke-RestMethod -Uri "https://api.stripe.com/v1/prices/$priceId" -Headers $headers -Method Get
    if (-not $price.active) { throw "$name ($priceId) is inactive." }
    if ($price.type -ne 'recurring' -or $null -eq $price.recurring) { throw "$name ($priceId) is not recurring." }
    Write-Host ("{0}: OK ({1}, {2} {3})" -f $name, $priceId, $price.recurring.interval, $price.unit_amount)
}

Write-Host 'Stripe catalog validation passed.'
