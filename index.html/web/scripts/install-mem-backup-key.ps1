[CmdletBinding()]
param(
    [string]$Key,
    [string]$Dir,
    [switch]$Force,
    [switch]$Status
)

# ---------------------------------------------------------------------------
# install-mem-backup-key.ps1 -- REV-39 MISSION 1: open the sovereign memory
# backup vault by installing its two secrets into the USER environment, once,
# permanently (Codex ch.11 영구 기억, ch.4 제로 핸즈).
#
# WHY A SCRIPT AND NOT A ONE-LINER. Setting the key by hand is the single
# manual step the whole backup chain depended on, and it was never done -- the
# v37 audit found zero usable snapshots of a 101 MB memory database. A script
# makes it repeatable, auditable, and safe to re-run.
#
# WHY IT REFUSES TO OVERWRITE AN EXISTING KEY. Every archive already in the
# vault is encrypted with the key that was current when it was written. Rotate
# the key and those archives become permanently undecryptable -- the backup
# would still look healthy while being worthless. So an existing key is left
# alone unless -Force is passed, and -Force prints the loss it will cause.
#
# THE KEY NEVER TOUCHES THE REPO. It lives only in the USER environment, which
# the scheduled task and future shells inherit. It is printed to the console
# exactly once, at generation time, for the founder to store off-machine.
#
#   npm run mem:install-key                                  # generate + install
#   npm run mem:install-key -- -Dir 'C:\Users\me\OneDrive\Vault'
#   npm run mem:install-key -- -Key '<passphrase>'           # bring your own
#   npm run mem:install-key -- -Status
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'
$KEY_VAR = 'UNITAS_MEM_BACKUP_KEY'
$DIR_VAR = 'UNITAS_MEM_BACKUP_DIR'

function Get-UserVar([string]$name) { [Environment]::GetEnvironmentVariable($name, 'User') }
function Set-UserVar([string]$name, [string]$value) {
    [Environment]::SetEnvironmentVariable($name, $value, 'User')
    Set-Item -Path "Env:$name" -Value $value   # so the current process sees it too
}

if ($Status) {
    $k = Get-UserVar $KEY_VAR
    $d = Get-UserVar $DIR_VAR
    Write-Host "Key   : $(if ($k) { "set (User env, $($k.Length) chars)" } else { 'NOT SET -- backups refuse to run' })"
    Write-Host "Vault : $(if ($d) { $d } else { "(unset -> default $env:USERPROFILE\.unitas-mem-vault)" })"
    if ($d -and (Test-Path $d)) {
        $archives = @(Get-ChildItem $d -Filter '*.enc' -ErrorAction SilentlyContinue)
        Write-Host "Archives: $($archives.Count)"
    }
    return
}

# --- the vault directory ---------------------------------------------------
if (-not $Dir) {
    $Dir = Get-UserVar $DIR_VAR
    if (-not $Dir) { $Dir = Join-Path $env:USERPROFILE '.unitas-mem-vault' }
}
if (-not (Test-Path $Dir)) {
    New-Item -ItemType Directory -Path $Dir -Force | Out-Null
    Write-Host "Created vault directory: $Dir"
}
Set-UserVar $DIR_VAR $Dir
Write-Host "$DIR_VAR = $Dir"

# --- the encryption key ----------------------------------------------------
$existing = Get-UserVar $KEY_VAR
if ($existing -and -not $Force -and -not $Key) {
    Write-Host "$KEY_VAR is already set ($($existing.Length) chars) -- left untouched."
    Write-Host 'Rotating it would make every existing archive undecryptable. Pass -Force only if you accept that.'
    return
}
if ($existing -and $Force) {
    $n = @(Get-ChildItem $Dir -Filter '*.enc' -ErrorAction SilentlyContinue).Count
    Write-Host "WARNING: -Force rotates the key. $n existing archive(s) in $Dir become permanently undecryptable."
}

$generated = $false
if (-not $Key) {
    # 48 random bytes -> 64 base64url chars. Far beyond scrypt's needs and safe
    # to carry through a shell, a task definition, and a clipboard.
    # RandomNumberGenerator.Fill() is .NET Core only; Create().GetBytes() works
    # on Windows PowerShell 5.1 and PowerShell 7 alike.
    $bytes = New-Object byte[] 48
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $Key = [Convert]::ToBase64String($bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=')
    $generated = $true
}

Set-UserVar $KEY_VAR $Key
Write-Host "$KEY_VAR installed ($($Key.Length) chars, User environment)."

if ($generated) {
    Write-Host ''
    Write-Host '================= STORE THIS OFF-MACHINE. IT IS SHOWN ONCE. ================='
    Write-Host $Key
    Write-Host '============================================================================'
    Write-Host 'Without this string the encrypted archives can never be restored.'
}
