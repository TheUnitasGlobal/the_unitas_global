[CmdletBinding()]
param(
    [string]$Time = '04:20',
    [switch]$Uninstall,
    [switch]$Status,
    [switch]$Preflight
)

# ---------------------------------------------------------------------------
# install-review-archive-task.ps1 — Review Agent archive automation
# (founder directive 2026-09-08; hardened + registered 2026-09-17 under
# MISSION 4 / FINAL_REPORT A-6).
#
# scripts/review-agent-archive.mjs mirrors the Review Agent's nightly audit
# runs into ~/life/review/ (JSON + a companion markdown executive-briefing
# file), but that script has always required the founder to run it by hand
# -- a serverless route has no durable home directory to write into, so the
# archive step can only run FROM the founder's own machine (see that
# script's header comment).
#
# This installer closes that last manual gap: it registers a Windows
# Task Scheduler entry that runs `node scripts/review-agent-archive.mjs`
# once a day, a few minutes after the Vercel cron (web/vercel.json, 04:00
# UTC) has finished writing the day's run -- so the local archive stays
# current without the founder remembering to run the script.
#
# WHY IT WAS HARDENED (2026-09-17). Three defects made it unsafe to register:
#   1. It resolved the worker with `Join-Path (Get-Location) ...`, so running
#      it from anywhere except web/ registered a task pointing at a file that
#      does not exist -- and Task Scheduler reports that as a task that runs
#      and fails, nightly, silently. It now resolves from $PSScriptRoot like
#      install-idle-sensor-task.ps1 and install-resurrection-task.ps1.
#   2. It had no -Status, so "is it installed and did last night's run
#      succeed?" had no answer short of opening taskschd.msc.
#   3. It had no credential preflight. The worker needs
#      NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (it loads
#      web/.env.local itself -- verified in the script's loadEnvLocal()), and
#      registering a task whose worker cannot authenticate produces a red
#      LastTaskResult every night that nobody reads. -Preflight now reports
#      readiness by NAME (never by value), and registration prints the
#      verdict instead of pretending everything is wired.
#
# Usage (from web/, or anywhere -- paths resolve from $PSScriptRoot):
#   powershell -File scripts/install-review-archive-task.ps1              # daily at 04:20 local time
#   powershell -File scripts/install-review-archive-task.ps1 -Time 05:00  # custom time
#   powershell -File scripts/install-review-archive-task.ps1 -Status      # state + last result + credential readiness
#   powershell -File scripts/install-review-archive-task.ps1 -Preflight   # credential readiness only
#   powershell -File scripts/install-review-archive-task.ps1 -Uninstall   # remove the task
# npm aliases: life:review:install-task / life:review:archive
# trust-registry: unitas.review-archive.task
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'
$taskName = 'UnitasReviewAgentArchive'

$webDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$scriptPath = Join-Path $webDir 'scripts\review-agent-archive.mjs'

# Delegates to the worker's own `--check-credentials` mode rather than
# re-deriving the rules here.
#
# 2026-09-17 outage: this function used to do its own presence test --
# `$line -match '^\s*([A-Z0-9_]+)\s*=\s*(\S.*)$'` -- which needs only one
# non-whitespace character after the `=`. When `vercel env pull` wrote the
# literal placeholder `[SENSITIVE]` for the Secret-typed service-role key, the
# preflight printed "present ... credentials satisfied", and the very worker it
# had just vouched for died at 04:20 with `REST 401: Invalid API key`.
#
# A preflight that can disagree with the thing it is checking is worse than no
# preflight, because it converts a loud failure into a false green. So there is
# now exactly one implementation of "is this a credential" -- in
# scripts/credential-core.mjs -- and this function just runs it.
# Values are still never printed: the worker reports shape only (length, JWT
# role claim), never the secret itself.
function Write-CredentialReadiness {
    $node = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (-not $node) {
        Write-Warning 'Node.js is not on PATH; cannot run the credential preflight.'
        return $false
    }
    # Out-Host, not a bare call: a PowerShell function returns EVERYTHING that
    # lands on its output stream, so `& $node ...` alone would make the return
    # value an array of the worker's stdout lines plus the boolean -- and
    # `if (<non-empty array>)` is true even when the boolean is $false. That is
    # the same false-green this whole change exists to remove.
    & $node $scriptPath --check-credentials | Out-Host
    $code = $LASTEXITCODE
    if ($code -eq 0) { return $true }
    Write-Warning "The nightly archive will exit 1 until web/.env.local holds real credentials (preflight exit $code)."
    return $false
}

if ($Preflight) {
    Write-Host "Credential preflight for '$taskName':"
    if (Write-CredentialReadiness) { return } else { exit 78 }  # 78 = EX_CONFIG
}

if ($Status) {
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if (-not $task) {
        Write-Host "Scheduled task '$taskName' is not installed."
    } else {
        $info = $task | Get-ScheduledTaskInfo
        Write-Host "Task      : $taskName"
        Write-Host "State     : $($task.State)"
        Write-Host "Last run  : $($info.LastRunTime)  (result 0x$('{0:X}' -f $info.LastTaskResult))"
        Write-Host "Next run  : $($info.NextRunTime)"
        Write-Host "Principal : $($task.Principal.UserId) / $($task.Principal.LogonType) / $($task.Principal.RunLevel)"
        Write-Host "Action    : $($task.Actions[0].Execute) $($task.Actions[0].Arguments)"
    }
    $archiveDir = Join-Path $env:USERPROFILE 'life\review'
    if (Test-Path $archiveDir -PathType Container) {
        $count = @(Get-ChildItem $archiveDir -Filter '*.json' -ErrorAction SilentlyContinue).Count
        Write-Host "Archive   : $archiveDir ($count run(s) mirrored)"
    } else {
        Write-Host "Archive   : $archiveDir (not created yet)"
    }
    Write-Host 'Credentials:'
    Write-CredentialReadiness | Out-Null
    return
}

if ($Uninstall) {
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "Removed scheduled task '$taskName'."
    } else {
        Write-Host "No scheduled task named '$taskName' found."
    }
    return
}

$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodePath) { throw 'Node.js is required on PATH to schedule this task.' }
if (-not (Test-Path $scriptPath -PathType Leaf)) {
    throw "scripts/review-agent-archive.mjs not found at $scriptPath."
}

$action = New-ScheduledTaskAction -Execute $nodePath -Argument "`"$scriptPath`"" -WorkingDirectory $webDir
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -Priority 7 `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description `
    'THE UNITAS GLOBAL -- Codex ch.14 review-agent briefing archive. Mirrors the Review Agent nightly audit runs into ~/life/review/ (JSON + markdown briefing) a few minutes after the Vercel cron at 04:00 UTC. Local, model-free, token 0. Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in web/.env.local. trust-registry: unitas.review-archive.task (index.html/config/security/trust-registry.json)' `
    -Force | Out-Null

Write-Host "Registered scheduled task '$taskName' -- runs daily at $Time (local time)."
Write-Host "Worker    : $scriptPath"
Write-Host 'Credentials:'
Write-CredentialReadiness | Out-Null
Write-Host "Status    : powershell -File scripts/install-review-archive-task.ps1 -Status"
Write-Host "To remove : powershell -File scripts/install-review-archive-task.ps1 -Uninstall"
