<#
.SYNOPSIS
  Sovereign Agent Toolchain - idempotent installer / status board for the 12-tool stack (Windows 11).

.DESCRIPTION
  Installs and verifies, without ever touching ~/.claude/settings.json routing:
    1. Token optimisation      : Headroom proxy (pip headroom-ai[proxy]), task-observer skill
    2. Multi-model gateway     : OmniRoute (npm), Ollama desktop (winget) + qwen3:4b, mcporter
    3. Agent skill / research  : Agent-Reach (uv tool), find-skills, agent-browser (+ Chrome runtime),
                                 systematic-debugging, skill-creator, yt-dlp, gh CLI
    4. Design acceleration     : UI/UX Pro Max (7 skills), 21st.dev MCP (key-gated), shadcn registry link
  Skills are installed at USER scope (~/.claude/skills) so they load in every session regardless of the
  working directory (this repo is driven from C:\dev\unitas while the app lives in index.html/web).
  All model routing is opt-in through scripts/agent/*.ps1 launchers (per-process env only).

.PARAMETER Install     Perform installs (default = status only).
.PARAMETER PullModel   Also pull the default local model (qwen3:4b, 2.5 GB) - low-memory laptop ceiling.
.PARAMETER SkipWinget  Skip winget packages (Ollama, GitHub CLI).

.EXAMPLE
  npm run setup:toolchain                       # status board
  npm run setup:toolchain -- -Install -PullModel

.NOTES
  Measured 2026-09-10 on the founder laptop (7.6 GB RAM, Iris Xe): local inference needs >= 3.5 GB free RAM.
  Versions are pinned to what was verified; bump deliberately.
#>
[CmdletBinding()]
param(
    [switch]$Install,
    [switch]$PullModel,
    [switch]$SkipWinget
)

$ErrorActionPreference = 'Stop'
$PIN = @{
    agentBrowser = '0.37.1'
    omniroute    = '3.8.50'
    mcporter     = '0.13.10'
    headroom     = '0.37.0'
    skillsCli    = '1.5.25'
    uiuxProMax   = '2.15.0'
    agentReach   = 'v1.5.0'
    localModel   = 'qwen3:4b'
}
$OMNI_ALLOW_SCRIPTS = 'omniroute,keytar,onnxruntime-node,tls-client-node,sharp,@parcel/watcher,@swc/core,protobufjs,koffi,esbuild'
$SKILLS = @(
    @{ repo = 'rebelytics/one-skill-to-rule-them-all'; skill = 'task-observer' },
    @{ repo = 'vercel-labs/skills';                     skill = 'find-skills' },
    @{ repo = 'vercel-labs/agent-browser';              skill = 'agent-browser' },
    @{ repo = 'obra/superpowers';                       skill = 'systematic-debugging' },
    @{ repo = 'anthropics/skills';                      skill = 'skill-creator' }
)
$UIUX_SKILLS = @('ui-ux-pro-max', 'banner-design', 'brand', 'design', 'design-system', 'slides', 'ui-styling')
$OLLAMA_ENV = @{
    OLLAMA_CONTEXT_LENGTH    = '32768'   # Claude Code needs >= 32k; default is 4k without a big GPU
    OLLAMA_MAX_LOADED_MODELS = '1'
    OLLAMA_NUM_PARALLEL      = '1'
    OLLAMA_FLASH_ATTENTION   = '1'
    OLLAMA_KV_CACHE_TYPE     = 'q8_0'    # halves KV cache RAM at 32k context
    OLLAMA_KEEP_ALIVE        = '5m'      # model auto-unloads -> zero idle cost
}

function Test-Tool([string]$Name) { return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue) }
function Get-Version([string]$Name, [string[]]$Arguments) {
    try { $out = & $Name @Arguments 2>$null | Select-Object -First 1; if ($out) { return "$out".Trim() } } catch {}
    return $null
}
function Invoke-Step([string]$Label, [scriptblock]$Body) {
    Write-Host "-- $Label" -ForegroundColor Cyan
    & $Body
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw "$Label failed (exit $LASTEXITCODE)" }
}

$userHome   = $env:USERPROFILE
$skillsHome = Join-Path $userHome '.claude\skills'
$pyScripts  = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\Scripts'
$uvBin      = Join-Path $userHome '.local\bin'
$ollamaDir  = Join-Path $env:LOCALAPPDATA 'Programs\Ollama'
$env:PATH   = "$pyScripts;$uvBin;$ollamaDir;C:\Program Files\GitHub CLI;$env:PATH"

foreach ($tool in @('node', 'npm', 'python')) {
    if (-not (Test-Tool $tool)) { throw "Required tool '$tool' is missing (Node.js 24 LTS + Python 3.12 expected)." }
}

if ($Install) {
    Invoke-Step 'agent-browser (npm global) + Chrome for Testing runtime' {
        npm install -g "agent-browser@$($PIN.agentBrowser)"
        agent-browser install
    }
    Invoke-Step 'OmniRoute gateway (npm global, native postinstall allowed)' {
        npm install -g "omniroute@$($PIN.omniroute)" "--allow-scripts=$OMNI_ALLOW_SCRIPTS"
    }
    Invoke-Step 'mcporter (Agent-Reach search backend) + Exa remote MCP at home scope' {
        npm install -g "mcporter@$($PIN.mcporter)"
        Push-Location $userHome
        try { mcporter config add exa https://mcp.exa.ai/mcp --scope home } finally { Pop-Location }
    }
    Invoke-Step 'Headroom proxy (pip, [proxy] extra only - [all] drags torch)' {
        python -m pip install --upgrade "headroom-ai[proxy]==$($PIN.headroom)"
    }
    if (-not (Test-Tool 'uv')) { Invoke-Step 'uv (Python tool manager)' { python -m pip install --user uv } }
    Invoke-Step "Agent-Reach $($PIN.agentReach) (uv tool, pinned tag)" {
        uv tool install --python 3.12 "https://github.com/Panniantong/agent-reach/archive/refs/tags/$($PIN.agentReach).zip"
        uv tool install yt-dlp
    }
    if (-not $SkipWinget) {
        if (-not (Test-Path (Join-Path $ollamaDir 'ollama.exe'))) {
            Invoke-Step 'Ollama desktop (winget)' { winget install --id Ollama.Ollama --exact --silent --accept-source-agreements --accept-package-agreements --disable-interactivity }
        }
        if (-not (Test-Tool 'gh')) {
            Invoke-Step 'GitHub CLI (winget, Agent-Reach GitHub channel)' { winget install --id GitHub.cli --exact --silent --accept-source-agreements --accept-package-agreements --disable-interactivity }
        }
    }
    Invoke-Step 'Ollama server env (User scope)' {
        foreach ($k in $OLLAMA_ENV.Keys) { [Environment]::SetEnvironmentVariable($k, $OLLAMA_ENV[$k], 'User') }
        Write-Host '   (restart the Ollama tray app once for the new env to apply)'
    }
    Invoke-Step 'Skills (user scope, copied - avoids Windows junction gap vercel-labs/skills#851)' {
        foreach ($s in $SKILLS) {
            npx -y "skills@$($PIN.skillsCli)" add $s.repo --skill $s.skill -a claude-code -g -y --copy
        }
    }
    Invoke-Step 'UI/UX Pro Max (7 skills, user scope, no CLAUDE.md edits)' {
        Push-Location $userHome
        try { npx -y "ui-ux-pro-max-cli@$($PIN.uiuxProMax)" init --ai claude --global } finally { Pop-Location }
    }
    Invoke-Step 'Agent-Reach skill registration + channel doctor' {
        $env:AGENT_REACH_LANG = 'en'; $env:PYTHONIOENCODING = 'utf-8'
        agent-reach install --env=auto
    }
    if ($PullModel) {
        Invoke-Step "Ollama model pull $($PIN.localModel)" { & (Join-Path $ollamaDir 'ollama.exe') pull $PIN.localModel }
    }
    $key21 = $env:API_KEY_21ST
    if ([string]::IsNullOrWhiteSpace($key21)) { $key21 = [Environment]::GetEnvironmentVariable('API_KEY_21ST', 'User') }
    if (-not [string]::IsNullOrWhiteSpace($key21)) {
        Invoke-Step '21st.dev MCP (user scope, env-referenced key)' { & (Join-Path $PSScriptRoot 'agent\setup-21st.ps1') -Persist }
    } else {
        Write-Host '-- 21st.dev MCP skipped: set $env:API_KEY_21ST then run scripts/agent/setup-21st.ps1 -Persist (fail-closed).' -ForegroundColor Yellow
    }
}

# ---------------------------------------------------------------- status board
Write-Host ''
Write-Host 'Sovereign Agent Toolchain status' -ForegroundColor Green
$rows = @()
$rows += [pscustomobject]@{ Tool = 'agent-browser'; Version = (Get-Version 'agent-browser' @('--version')); Ready = (Test-Tool 'agent-browser') }
$rows += [pscustomobject]@{ Tool = 'omniroute';     Version = (Get-Version 'omniroute' @('--version'));     Ready = (Test-Tool 'omniroute') }
$rows += [pscustomobject]@{ Tool = 'mcporter';      Version = (Get-Version 'mcporter' @('--version'));      Ready = (Test-Tool 'mcporter') }
$rows += [pscustomobject]@{ Tool = 'headroom';      Version = (Get-Version 'headroom' @('--version'));      Ready = (Test-Tool 'headroom') }
$rows += [pscustomobject]@{ Tool = 'agent-reach';   Version = (Get-Version 'agent-reach' @('--version'));   Ready = (Test-Tool 'agent-reach') }
$rows += [pscustomobject]@{ Tool = 'yt-dlp';        Version = (Get-Version 'yt-dlp' @('--version'));        Ready = (Test-Tool 'yt-dlp') }
$rows += [pscustomobject]@{ Tool = 'gh';            Version = (Get-Version 'gh' @('--version'));            Ready = (Test-Tool 'gh') }
$rows += [pscustomobject]@{ Tool = 'ollama';        Version = (Get-Version 'ollama' @('--version'));        Ready = (Test-Path (Join-Path $ollamaDir 'ollama.exe')) }
$rows | Format-Table -AutoSize | Out-String | Write-Host

$ollamaUp = $false
try { $v = (Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/version' -TimeoutSec 3).version; $ollamaUp = $true; Write-Host "Ollama API: up ($v)" } catch { Write-Host 'Ollama API: down (tray app not running)' }
if ($ollamaUp) {
    $tags = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 5
    $names = @($tags.models | ForEach-Object { $_.name })
    $hasModel = $names -contains $PIN.localModel
    $modelList = 'none'
    if ($names) { $modelList = $names -join ', ' }
    $modelState = 'MISSING - run -PullModel'
    if ($hasModel) { $modelState = 'present' }
    Write-Host ("Local models: {0}  (default {1}: {2})" -f $modelList, $PIN.localModel, $modelState)
}
$freeGB = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB, 2)
Write-Host "Free RAM now: $freeGB GB (local inference needs >= 3.5 GB free)"

Write-Host ''
Write-Host 'Skills (user scope ~/.claude/skills):'
$expected = @($SKILLS | ForEach-Object { $_.skill }) + $UIUX_SKILLS + @('agent-reach')
foreach ($name in $expected) {
    $state = 'MISSING'
    if (Test-Path (Join-Path $skillsHome "$name\SKILL.md")) { $state = 'ready' }
    Write-Host ("  {0,-22} {1}" -f $name, $state)
}

Write-Host ''
$key21User = [Environment]::GetEnvironmentVariable('API_KEY_21ST', 'User')
$keyState = if ([string]::IsNullOrWhiteSpace($key21User)) { 'API_KEY_21ST: missing (User env)' } else { "API_KEY_21ST: User env (tail $($key21User.Substring($key21User.Length - 4)))" }
if (-not [string]::IsNullOrWhiteSpace($key21User)) { $env:API_KEY_21ST = $key21User }
$mcpState = 'not registered - run scripts/agent/setup-21st.ps1 -Persist'
try {
    $get21 = & claude mcp get 21st 2>$null | Out-String
    if ($get21 -match 'Connected') { $mcpState = 'registered (user scope, ${API_KEY_21ST} header) - connected' }
    elseif ($get21 -match 'Needs authentication') { $mcpState = 'registered but API_KEY_21ST unresolved - Needs authentication (fail-closed)' }
    elseif ($get21 -match 'Scope') { $mcpState = 'registered but not connected - check network / key' }
} catch {}
Write-Host "21st.dev MCP: $mcpState  [$keyState]"
$reg21 = 'missing'
try { $cj = Get-Content (Join-Path $PSScriptRoot '..\web\components.json') -Raw | ConvertFrom-Json; if ($cj.registries.'@21st') { $reg21 = 'web/components.json @21st -> npx shadcn@latest add @21st/<author>/<slug>' } } catch {}
Write-Host "21st.dev shadcn registry: $reg21"
Write-Host ''
Write-Host 'Launchers (per-process routing, nothing persisted):'
Write-Host '  scripts/agent/claude-headroom.ps1    Claude Code via Headroom compression proxy (127.0.0.1:8787)'
Write-Host '  scripts/agent/claude-local.ps1       Claude Code on local Ollama qwen3:4b (private, $0)'
Write-Host '  scripts/agent/omniroute-gateway.ps1  start/stop/status OmniRoute (127.0.0.1:20128)'
Write-Host '  scripts/agent/claude-omniroute.ps1   Claude Code via OmniRoute combos (needs OMNIROUTE_API_KEY)'
Write-Host '  scripts/agent/setup-21st.ps1         register/remove the 21st.dev HTTP MCP (key stays in User env, -Persist / -Remove)'
Write-Host 'No ~/.claude/settings.json, CLAUDE.md, Supabase or Vercel settings were modified.'
