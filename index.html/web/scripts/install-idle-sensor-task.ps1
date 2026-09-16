[CmdletBinding()]
param(
    [switch]$Uninstall,
    [switch]$Status
)

# ---------------------------------------------------------------------------
# install-idle-sensor-task.ps1 -- Codex ch.13 stage-3 idle sensor, at-logon
# Windows Task Scheduler installer (REV-35 M2, founder directive 2026-09-16,
# SPEC.md D-9 / D-11).
#
# scripts/idle-sensor-daemon.mjs is the doctrine's stage-3 executor: after
# ten minutes with no founder activity on any channel (Claude transcripts,
# git, the web/ worktree, keyboard/mouse) it runs the 3-engine Playwright
# sweep at IDLE priority and cancels it the instant activity resumes. A
# long-running process needs a home that survives reboots; this installer
# registers it as a scheduled task that starts at the founder's logon.
#
# Choices that matter (do not "simplify" them away):
#   * -LogonType Interactive  -- GetLastInputInfo only sees the founder's
#     input from the interactive session. "Run whether user is logged on or
#     not" lands the daemon in session 0 where the OS-idle probe reads 0 and
#     idleness could never be proven (fail-closed: no sweeps ever) -- or,
#     if the probe were ignored, it would sweep during active sessions.
#   * -RunLevel Limited       -- no elevation; the daemon only kills its own
#     process tree and a `next start` it recognises on :3123.
#   * ExecutionTimeLimit 0    -- the task is a daemon, not a job; the default
#     72 h limit would kill it mid-week.
#   * RestartCount 3 / 1 min  -- a crash restarts it; three in a row stops.
#   * MultipleInstances IgnoreNew -- second guard behind the daemon's own
#     test-results/stage3/daemon.lock.
#   * Priority 9              -- the daemon itself runs below normal so its
#     polling never competes with the founder's work.
#   * Stop-on-batteries       -- Task Scheduler default kept (laptop-friendly).
#   * Hidden window           -- node.exe is a console app; wrapping it in
#     `powershell -WindowStyle Hidden -Command` keeps logon free of a flash.
#
# Deliberately NOT invoked by anything else in this repo (not npm prebuild,
# not the Stop hook, not CI): registering a standing OS-level task is a
# machine-wide change the founder opts into once (SPEC.md D-11 -- the
# "영구 각인" directive is that opt-in; the main session runs this after the
# stage-1 gates and the commit).
#
# Usage (from web/, or anywhere -- paths resolve from this script's location):
#   powershell -File scripts/install-idle-sensor-task.ps1             # register (idempotent) + start now
#   powershell -File scripts/install-idle-sensor-task.ps1 -Status     # state, last run, lock, latest sweep
#   powershell -File scripts/install-idle-sensor-task.ps1 -Uninstall  # remove the task
# npm aliases: idle:sensor:install-task / idle:sensor:status / idle:sensor:uninstall-task
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'
$taskName = 'UnitasIdleSensorStage3'

$webDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$scriptPath = Join-Path $webDir 'scripts\idle-sensor-daemon.mjs'
$stage3Dir = Join-Path (Split-Path $webDir -Parent) 'test-results\stage3'

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
    $lockPath = Join-Path $stage3Dir 'daemon.lock'
    if (Test-Path $lockPath -PathType Leaf) {
        $lock = Get-Content $lockPath -Raw | ConvertFrom-Json
        $alive = Get-Process -Id $lock.pid -ErrorAction SilentlyContinue
        Write-Host "Lock      : pid $($lock.pid) $(if ($alive) { '(alive)' } else { '(stale -- no such process)' })"
    } else {
        Write-Host 'Lock      : none'
    }
    $latestPath = Join-Path $stage3Dir 'latest.json'
    if (Test-Path $latestPath -PathType Leaf) {
        $latest = Get-Content $latestPath -Raw | ConvertFrom-Json
        Write-Host "Latest    : $($latest.status) -- build $($latest.buildId) head $($latest.head.Substring(0, [Math]::Min(7, $latest.head.Length))) at $($latest.finishedAt) (pass $($latest.totals.expected) fail $($latest.totals.unexpected) skip $($latest.totals.skipped))"
        Write-Host "Briefing  : $(Join-Path $stage3Dir 'latest.md')"
    } else {
        Write-Host 'Latest    : no sweep recorded yet'
    }
    $dllPath = Join-Path $env:LOCALAPPDATA 'THE UNITAS GLOBAL\IdleSensor\UnitasLastInput.dll'
    Write-Host "Probe DLL : $(if (Test-Path $dllPath) { 'present' } else { 'not compiled yet' })  ($dllPath)"
    Write-Host 'Trust     :'
    try {
        Push-Location $webDir
        & node scripts/trust-registry.mjs --verify
        Pop-Location
    } catch {
        Write-Host "  (trust-registry check failed: $($_.Exception.Message))"
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
    throw "scripts/idle-sensor-daemon.mjs not found at $scriptPath."
}

# REV-36 M1: compile the on-disk idle probe assembly once up front, so the
# first sweep does not pay the compile cost and so the DLL exists to be scanned
# (docs/security/TRUST_REGISTRY.md). Non-fatal if it cannot compile now.
$probePath = Join-Path $webDir 'scripts\idle-sensor-probe.ps1'
if (Test-Path $probePath -PathType Leaf) {
    try {
        $probe = & powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $probePath -Compile | ConvertFrom-Json
        Write-Host "Idle probe : assembly $($probe.assembly), idleMs $($probe.idleMs)"
    } catch {
        Write-Host "Idle probe : could not pre-compile ($($_.Exception.Message)) -- the daemon will compile on first tick."
    }
}

$powershellPath = (Get-Command powershell.exe).Source
$user = "$env:USERDOMAIN\$env:USERNAME"

# The daemon path and node path are single-quoted inside the -Command string so
# spaces in either survive both the scheduler and PowerShell's parser.
$argument = "-NoProfile -WindowStyle Hidden -Command `"& '$nodePath' '$scriptPath'`""
$action = New-ScheduledTaskAction -Execute $powershellPath -Argument $argument -WorkingDirectory $webDir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
    -MultipleInstances IgnoreNew `
    -Priority 9 `
    -StartWhenAvailable -DontStopOnIdleEnd

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description `
    'THE UNITAS GLOBAL -- Codex ch.13 stage-3 idle sensor. After 10 idle minutes runs the 3-engine Playwright sweep (tests/web-cinema.config.js) at idle priority, cancels on activity, writes index.html/test-results/stage3/latest.md. Read via docs/stage3/READER.md. trust-registry: unitas.idle-sensor.task (index.html/config/security/trust-registry.json . docs/security/TRUST_REGISTRY.md)' `
    -Force | Out-Null

Start-ScheduledTask -TaskName $taskName

Write-Host "Registered scheduled task '$taskName' -- at logon of $user (interactive), started now."
Write-Host "Daemon    : $scriptPath"
Write-Host "Results   : $stage3Dir\latest.md  (log: daemon.log)"
Write-Host "Status    : powershell -File scripts/install-idle-sensor-task.ps1 -Status"
Write-Host "To remove : powershell -File scripts/install-idle-sensor-task.ps1 -Uninstall"
