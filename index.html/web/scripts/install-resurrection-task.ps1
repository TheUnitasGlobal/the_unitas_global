[CmdletBinding()]
param(
    [switch]$Uninstall,
    [switch]$Status
)

# ---------------------------------------------------------------------------
# install-resurrection-task.ps1 -- Codex v41.0 제4장 자율 부활 데몬, at-logon
# Windows Task Scheduler installer (founder directive 2026-09-17, MISSION 2 /
# FINAL_REPORT A-3).
#
# scripts/resurrection-daemon.mjs is the chapter's executor: every 10 minutes
# it self-checks, and when agent computation has been silent for 60+ minutes
# WITH work demonstrably in flight, it resumes the session by itself. A watcher
# that only exists while a terminal happens to be open is not a watcher -- the
# whole point is that it survives the session it is watching. Hence a scheduled
# task that starts at logon.
#
# Choices that matter (do not "simplify" them away):
#   * -LogonType Interactive  -- the daemon spawns `claude`, which must land in
#     the founder's interactive session. Session 0 would start a headless agent
#     nobody can see or interrupt.
#   * -RunLevel Limited       -- no elevation, ever. This process starts an
#     agent with write access to the repo; it must not also hold admin.
#   * ExecutionTimeLimit 0    -- it is a daemon, not a job. The 72 h default
#     would kill it mid-week.
#   * RestartCount 3 / 5 min  -- a crash restarts it; three in a row stops, so
#     a structurally broken daemon cannot hot-loop.
#   * MultipleInstances IgnoreNew -- second guard behind the daemon's own
#     test-results/resurrection/daemon.lock.
#   * Priority 9              -- below normal; self-checks must never compete
#     with the founder's work.
#   * NO -StartWhenAvailable  -- deliberately different from the idle sensor.
#     Catch-up runs after a missed window would fire a resume decision against
#     a stale clock; this daemon should start when the founder logs on and
#     reason from live signals only.
#
# THE KILL SWITCH IS PART OF THE INSTALL CONTRACT. Creating
#   index.html/test-results/resurrection/DISARMED
# stops every future resume without touching the task. -Status reports it.
#
# Usage (from web/, or anywhere -- paths resolve from $PSScriptRoot):
#   powershell -File scripts/install-resurrection-task.ps1             # register + start
#   powershell -File scripts/install-resurrection-task.ps1 -Status     # state, lock, armed/disarmed, budget
#   powershell -File scripts/install-resurrection-task.ps1 -Uninstall  # remove
# npm aliases: resurrect:install-task / resurrect:status / resurrect:uninstall-task
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'
$taskName = 'UnitasResurrectionDaemon'

$webDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$scriptPath = Join-Path $webDir 'scripts\resurrection-daemon.mjs'
$stateDir = Join-Path (Split-Path $webDir -Parent) 'test-results\resurrection'

if ($Status) {
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if (-not $task) {
        Write-Host "Scheduled task '$taskName' is not installed."
    } else {
        $info = $task | Get-ScheduledTaskInfo
        Write-Host "Task      : $taskName"
        Write-Host "State     : $($task.State)"
        Write-Host "Last run  : $($info.LastRunTime)  (result 0x$('{0:X}' -f $info.LastTaskResult))"
        Write-Host "Principal : $($task.Principal.UserId) / $($task.Principal.LogonType) / $($task.Principal.RunLevel)"
        Write-Host "Action    : $($task.Actions[0].Execute) $($task.Actions[0].Arguments)"
    }
    $lockPath = Join-Path $stateDir 'daemon.lock'
    if (Test-Path $lockPath -PathType Leaf) {
        $lock = Get-Content $lockPath -Raw | ConvertFrom-Json
        $alive = Get-Process -Id $lock.pid -ErrorAction SilentlyContinue
        Write-Host "Lock      : pid $($lock.pid) $(if ($alive) { '(alive)' } else { '(stale -- no such process)' })"
    } else {
        Write-Host 'Lock      : none'
    }
    Write-Host ''
    try {
        Push-Location $webDir
        & node scripts/resurrection-daemon.mjs --status
    } finally {
        Pop-Location
    }
    return
}

if ($Uninstall) {
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
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
    throw "scripts/resurrection-daemon.mjs not found at $scriptPath."
}
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    Write-Warning 'Claude Code CLI is not on PATH. The daemon will install and self-check, but a resume would fail until `claude` is reachable from a logon shell.'
}

$powershellPath = (Get-Command powershell.exe).Source
$user = "$env:USERDOMAIN\$env:USERNAME"

$argument = "-NoProfile -WindowStyle Hidden -Command `"& '$nodePath' '$scriptPath'`""
$action = New-ScheduledTaskAction -Execute $powershellPath -Argument $argument -WorkingDirectory $webDir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5) `
    -MultipleInstances IgnoreNew `
    -Priority 9 `
    -DontStopOnIdleEnd

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description `
    'THE UNITAS GLOBAL -- Codex v41.0 ch.4 Self-Resurrecting Daemon. Self-checks every 10 minutes; when agent computation has been halted 60+ minutes with work in flight (a user turn that never got a reply), resumes the Claude Code session autonomously. ARMED/DISARMED with a hard budget of 3 resumes per rolling 24h and 60/120/240-minute backoff; kill switch index.html/test-results/resurrection/DISARMED. trust-registry: unitas.resurrection.task (index.html/config/security/trust-registry.json)' `
    -Force | Out-Null

Start-ScheduledTask -TaskName $taskName

Write-Host "Registered scheduled task '$taskName' -- at logon of $user (interactive), started now."
Write-Host "Daemon     : $scriptPath"
Write-Host "State      : $stateDir\state.json  (log: daemon.log)"
Write-Host "Kill switch: $stateDir\DISARMED  (create it to suspend every future resume)"
Write-Host "Status     : powershell -File scripts/install-resurrection-task.ps1 -Status"
Write-Host "To remove  : powershell -File scripts/install-resurrection-task.ps1 -Uninstall"
