[CmdletBinding()]
param(
    [switch]$Uninstall,
    [switch]$Status,
    [string]$Time = '04:30'
)

# ---------------------------------------------------------------------------
# install-mem-backup-task.ps1 -- REV-39 MISSION 2: schedule the sovereign
# backup of the permanent memory (Codex ch.11 영구 기억, ch.13 Fail-Closed).
# Trust-registry id: unitas.claude-mem.task
#
# The v37 audit found the only snapshot of ~/.claude-mem was a 311 KB file from
# an upgrade weeks earlier containing zero observations: one disk failure would
# have erased 2,585+ observations permanently. scripts/claude-mem-backup.mjs
# makes an encrypted, verified archive; this registers it to run daily so the
# protection does not depend on anyone remembering.
#
# THE KEY IS NOT STORED HERE. The task inherits UNITAS_MEM_BACKUP_KEY from the
# USER environment, so set it once (and out of the repo):
#   [Environment]::SetEnvironmentVariable('UNITAS_MEM_BACKUP_KEY','<passphrase>','User')
# Without the key the backup script refuses to run rather than writing the
# memory unencrypted -- the task will simply fail loudly, which is correct.
#
#   npm run mem:install-task            # register daily at 04:30
#   npm run mem:install-task -- -Time 03:00
#   npm run mem:install-task -- -Status
#   npm run mem:uninstall-task
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'
$taskName = 'UnitasMemBackup'

$webDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$scriptPath = Join-Path $webDir 'scripts\claude-mem-backup.mjs'

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
    }
    $keySet = [Environment]::GetEnvironmentVariable('UNITAS_MEM_BACKUP_KEY', 'User')
    Write-Host "Key       : $(if ($keySet) { 'set (User env)' } else { 'NOT SET -- backups will refuse to run' })"
    $vault = [Environment]::GetEnvironmentVariable('UNITAS_MEM_BACKUP_DIR', 'User')
    if (-not $vault) { $vault = Join-Path $env:USERPROFILE '.unitas-mem-vault' }
    Write-Host "Vault     : $vault"
    if (Test-Path $vault) {
        $archives = @(Get-ChildItem $vault -Filter '*.enc' -ErrorAction SilentlyContinue | Sort-Object Name -Descending)
        Write-Host "Archives  : $($archives.Count)$(if ($archives.Count) { "  newest $($archives[0].Name) ($([Math]::Round($archives[0].Length/1MB,1)) MB)" })"
    } else {
        Write-Host 'Archives  : (vault does not exist yet)'
    }
    Write-Host "Verify    : cd web; npm run mem:verify"
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
if (-not (Test-Path $scriptPath -PathType Leaf)) { throw "claude-mem-backup.mjs not found at $scriptPath." }

if (-not [Environment]::GetEnvironmentVariable('UNITAS_MEM_BACKUP_KEY', 'User')) {
    Write-Host 'WARNING: UNITAS_MEM_BACKUP_KEY is not set for this user.'
    Write-Host "  Set it with: [Environment]::SetEnvironmentVariable('UNITAS_MEM_BACKUP_KEY','<passphrase>','User')"
    Write-Host '  Until then the task will run and refuse (by design) rather than write plaintext memory.'
}

$powershellPath = (Get-Command powershell.exe).Source
$user = "$env:USERDOMAIN\$env:USERNAME"
$argument = "-NoProfile -WindowStyle Hidden -Command `"& '$nodePath' '$scriptPath'`""
$action = New-ScheduledTaskAction -Execute $powershellPath -Argument $argument -WorkingDirectory $webDir
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description `
    'THE UNITAS GLOBAL -- daily encrypted backup of the claude-mem permanent memory (AES-256-GCM, integrity-verified). Restore: web/scripts/claude-mem-restore.mjs. trust-registry: unitas.claude-mem.task' `
    -Force | Out-Null

Write-Host "Registered scheduled task '$taskName' -- daily at $Time."
Write-Host "Backup    : $scriptPath"
Write-Host "Verify    : cd web; npm run mem:verify"
Write-Host "To remove : npm run mem:uninstall-task"
