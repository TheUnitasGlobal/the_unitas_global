[CmdletBinding()]
param(
    [switch]$InstallMissing
)

$ErrorActionPreference = 'Stop'

function Test-Tool([string]$Name) {
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Install-WingetPackage([string]$Id, [string]$Name) {
    if (-not (Test-Tool 'winget')) {
        Write-Warning "winget is unavailable. Install $Name manually."
        return
    }

    Write-Host "Installing $Name..."
    winget install --id $Id --exact --accept-source-agreements --accept-package-agreements
}

function Install-PlaywrightBrowser {
    if (-not (Test-Path 'node_modules/.bin/playwright.cmd')) {
        throw 'Playwright CLI is missing. Run npm install first.'
    }

    Write-Host 'Installing Playwright Chromium browser...'
    & npx --no-install playwright install chromium
    if ($LASTEXITCODE -ne 0) { throw "Playwright browser installation failed with exit code $LASTEXITCODE." }
}

$requiredTools = @('node', 'npm')
foreach ($tool in $requiredTools) {
    if (-not (Test-Tool $tool)) {
        throw "Required tool '$tool' is missing. Install Node.js LTS first."
    }
}

if ($InstallMissing) {
    if (-not (Test-Tool 'git')) { Install-WingetPackage 'Git.Git' 'Git' }
    if (-not (Test-Tool 'stripe')) { Install-WingetPackage 'Stripe.StripeCli' 'Stripe CLI' }
    if (-not (Test-Tool 'dart')) { Install-WingetPackage 'Google.DartSDK' 'Dart SDK' }
    Install-PlaywrightBrowser
}

Write-Host ''
Write-Host 'Tool status:'
foreach ($tool in @('git', 'node', 'npm', 'stripe', 'flutter', 'dart')) {
    if (Test-Tool $tool) {
        $version = (& $tool --version 2>$null | Select-Object -First 1)
        Write-Host ("  {0}: {1}" -f $tool, $version)
    } else {
        Write-Host ("  {0}: NOT FOUND" -f $tool)
    }
}

if (Test-Path 'node_modules/.bin/supabase.cmd') {
    $supabaseVersion = (& npx --no-install supabase --version 2>$null | Select-Object -First 1)
    Write-Host ("  supabase: local npm CLI ({0})" -f $supabaseVersion)
} else {
    Write-Host '  supabase: NOT FOUND'
}

if (Test-Path 'node_modules/.bin/playwright.cmd') {
    $playwrightVersion = (& npx --no-install playwright --version 2>$null | Select-Object -First 1)
    Write-Host ("  playwright: local npm CLI ({0})" -f $playwrightVersion)
} else {
    Write-Host '  playwright: NOT FOUND'
}

if (-not (Test-Path '.env')) {
    Copy-Item '.env.example' '.env'
    Write-Warning 'Created .env from .env.example. Replace every placeholder before deployment.'
} else {
    Write-Host '.env already exists; leaving it unchanged.'
}

Write-Host ''
Write-Host 'FlutterFlow note: there is no official FlutterFlow CLI for deploying a project from this repository.'
Write-Host 'Use FLUTTERFLOW_API_BASE_URL and the Supabase function contract in docs/automation.md for custom actions.'
