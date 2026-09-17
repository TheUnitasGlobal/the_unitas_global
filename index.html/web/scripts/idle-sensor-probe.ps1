# ---------------------------------------------------------------------------
# idle-sensor-probe.ps1 -- Codex ch.15 stage-3 OS-idle + process-table probe.
# Trust-registry id: unitas.idle-sensor.probe
# (index.html/config/security/trust-registry.json · docs/security/TRUST_REGISTRY.md)
#
# WHY THIS FILE EXISTS (REV-36 M1). The daemon used to run its idle probe as a
# base64 inline command that compiled a C# type in memory every tick
# (`Add-Type -TypeDefinition`). An in-memory compiled assembly has no path and
# no stable hash, so it can NEVER be added to an allow-list -- a local security
# reviewer or an anti-malware heuristic sees "encoded PowerShell that JIT-
# compiles native interop and runs at logon" and reasonably calls it
# unauthorized persistence / malware-like behaviour. This is the founder's own
# authorized stage-3 sensor, so the fix is to make it INSPECTABLE, not to hide
# it: the probe is a plain script on disk, and the one native-interop type is
# compiled ONCE to a real DLL on disk that can be scanned, hashed and allow-
# listed (the trust registry pins the source scripts; the DLL is a derived
# artifact of a pinned source).
#
# Params:
#   -CacheDir  where the compiled DLL lives (default %LOCALAPPDATA%\THE UNITAS GLOBAL\IdleSensor)
#   -Compile   force a recompile (the installer passes this once at setup)
#
# Output: exactly ONE compact JSON line -- { idleMs, assembly, procs: [...] }.
# assembly is 'compiled' | 'cached' | 'unavailable'. On any failure idleMs is
# -1 so the daemon treats OS-idle as unknown and stays fail-closed (no sweep).
# Never throws, never writes outside CacheDir, never opens a network socket.
# ---------------------------------------------------------------------------
[CmdletBinding()]
param(
    [string]$CacheDir = (Join-Path $env:LOCALAPPDATA 'THE UNITAS GLOBAL\IdleSensor'),
    [switch]$Compile
)

$ErrorActionPreference = 'SilentlyContinue'

$idle = -1
$assemblyState = 'unavailable'
$dll = Join-Path $CacheDir 'UnitasLastInput.dll'

# The one piece of native interop: GetLastInputInfo, the only reliable measure
# of "the founder has not touched keyboard or mouse for N minutes".
$source = @'
using System;
using System.Runtime.InteropServices;
public static class UnitasLastInput {
  [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
  public static long IdleMs() {
    var info = new LASTINPUTINFO();
    info.cbSize = (uint)Marshal.SizeOf(info);
    if (!GetLastInputInfo(ref info)) return -1;
    return (long)(unchecked((uint)Environment.TickCount) - info.dwTime);
  }
}
'@

function Compile-Assembly {
    if (-not (Test-Path $CacheDir)) { New-Item -ItemType Directory -Path $CacheDir -Force | Out-Null }
    # -OutputAssembly writes the DLL to disk but (on Windows PowerShell 5.1)
    # does NOT load the type into this session, so it is paired with a load
    # via -Path below.
    Add-Type -TypeDefinition $source -OutputAssembly $dll
}

try {
    if ($Compile -or -not (Test-Path $dll)) {
        Compile-Assembly
        $assemblyState = 'compiled'
    } else {
        $assemblyState = 'cached'
    }
    try {
        Add-Type -Path $dll
    } catch {
        # A stale or corrupt DLL: rebuild it once, then load again.
        Remove-Item $dll -Force -ErrorAction SilentlyContinue
        Compile-Assembly
        $assemblyState = 'compiled'
        Add-Type -Path $dll
    }
    $idle = [UnitasLastInput]::IdleMs()
} catch {
    $idle = -1
    $assemblyState = 'unavailable'
}

# The process table the daemon's busy-process veto and port-reaper read. One
# CIM query so a tick costs one probe process, not several.
$procs = @(Get-CimInstance Win32_Process | ForEach-Object {
    $start = $null
    if ($_.CreationDate) { $start = [string]$_.CreationDate.ToFileTimeUtc() }
    [pscustomobject]@{ pid = [int]$_.ProcessId; ppid = [int]$_.ParentProcessId; start = $start; cmd = [string]$_.CommandLine }
})

[pscustomobject]@{ idleMs = [long]$idle; assembly = $assemblyState; procs = $procs } | ConvertTo-Json -Compress -Depth 3
