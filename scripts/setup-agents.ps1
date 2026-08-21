[CmdletBinding()]
param(
    [switch]$InstallProjectSkills,
    [switch]$RefreshSources
)

$ErrorActionPreference = 'Stop'
$toolRoot = Join-Path (Get-Location) '.agent-tools'
$skillRoot = Join-Path (Get-Location) '.agents/skills'

function Require-Directory([string]$Path, [string]$Name) {
    if (-not (Test-Path $Path -PathType Container)) {
        throw "$Name source is missing at $Path. Clone it before running this command."
    }
}

if ($RefreshSources) {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git is required.' }
    New-Item -ItemType Directory -Force $toolRoot | Out-Null
    $sources = @{
        'claude-mem' = 'https://github.com/thedotmack/claude-mem.git'
        'graphify' = 'https://github.com/safishamsi/graphify.git'
        'superpowers' = 'https://github.com/obra/superpowers.git'
        'strix' = 'https://github.com/usestrix/strix.git'
    }
    foreach ($name in $sources.Keys) {
        $destination = Join-Path $toolRoot $name
        if (Test-Path $destination) {
            git -C $destination pull --ff-only
        } else {
            git clone --depth 1 $sources[$name] $destination
        }
        if ($LASTEXITCODE -ne 0) { throw "Failed to refresh $name." }
    }
}

Require-Directory (Join-Path $toolRoot 'claude-mem') 'claude-mem'
Require-Directory (Join-Path $toolRoot 'graphify') 'graphify'
Require-Directory (Join-Path $toolRoot 'superpowers') 'superpowers'
Require-Directory (Join-Path $toolRoot 'strix') 'strix'

if ($InstallProjectSkills) {
    $graphifySkill = Join-Path $toolRoot 'graphify/graphify/skill.md'
    Require-Directory (Split-Path $graphifySkill) 'Graphify package'
    if (-not (Test-Path $graphifySkill -PathType Leaf)) { throw "Graphify skill is missing at $graphifySkill." }

    $graphifyDestination = Join-Path $skillRoot 'graphify'
    New-Item -ItemType Directory -Force $graphifyDestination | Out-Null
    Copy-Item $graphifySkill (Join-Path $graphifyDestination 'SKILL.md') -Force

    $superpowersSkills = Join-Path $toolRoot 'superpowers/skills'
    foreach ($skillFile in Get-ChildItem $superpowersSkills -Recurse -Filter 'SKILL.md' -File) {
        $skillName = Split-Path $skillFile.DirectoryName -Leaf
        $destination = Join-Path $skillRoot ("superpowers-$skillName")
        New-Item -ItemType Directory -Force $destination | Out-Null
        Copy-Item $skillFile.FullName (Join-Path $destination 'SKILL.md') -Force
    }
}

$manifest = Get-Content 'config/agent-toolkit.json' -Raw | ConvertFrom-Json
Write-Host ("Agent toolkit manifest: version {0}" -f $manifest.version)
foreach ($source in $manifest.sources.psobject.Properties) {
    $path = $source.Value.path
    if ($path) {
        $exists = Test-Path $path -PathType Container
        Write-Host ("  {0}: {1}" -f $source.Name, $(if ($exists) { 'ready' } else { 'not installed' }))
    } else {
        Write-Host ("  {0}: external entrypoint" -f $source.Name)
    }
}
Write-Host ("Project skills: {0}" -f $(if (Test-Path $skillRoot) { 'available' } else { 'not installed' }))
Write-Host 'No Supabase secrets, Stripe Price IDs, or user-level agent settings were modified.'
