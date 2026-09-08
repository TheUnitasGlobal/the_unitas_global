[CmdletBinding()]
param(
    [string]$Time = '04:20',
    [switch]$Uninstall
)

# ---------------------------------------------------------------------------
# install-review-archive-task.ps1 — Review Agent archive automation
# (founder directive 2026-09-08).
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
# Deliberately NOT invoked by anything else in this repo (not npm scripts,
# not the Stop hook, not CI) -- registering a persistent OS-level scheduled
# task is a machine-wide, standing change the founder should opt into
# explicitly, once, on whichever machine should own this job.
#
# Usage (run from web/):
#   powershell -File scripts/install-review-archive-task.ps1              # daily at 04:20 local time
#   powershell -File scripts/install-review-archive-task.ps1 -Time 05:00  # custom time
#   powershell -File scripts/install-review-archive-task.ps1 -Uninstall   # remove the task
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'
$taskName = 'UnitasReviewAgentArchive'

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

$scriptPath = Join-Path (Get-Location) 'scripts/review-agent-archive.mjs'
if (-not (Test-Path $scriptPath -PathType Leaf)) {
    throw "scripts/review-agent-archive.mjs not found at $scriptPath -- run this from the web/ directory."
}

$action = New-ScheduledTaskAction -Execute $nodePath -Argument "`"$scriptPath`"" -WorkingDirectory (Get-Location)
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description `
    'Mirrors THE UNITAS GLOBAL Review Agent nightly audit runs into ~/life/review/ (JSON + markdown briefing). Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in web/.env.local.' `
    -Force | Out-Null

Write-Host "Registered scheduled task '$taskName' -- runs daily at $Time (local time)."
Write-Host 'Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in web/.env.local (same as running the script by hand).'
Write-Host "To remove: powershell -File scripts/install-review-archive-task.ps1 -Uninstall"
