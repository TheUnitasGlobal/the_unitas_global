# LAN bridge for same-Wi-Fi mobile testing.
#
# Prints the PC's LAN URL so a phone on the same Wi-Fi can open the live dev
# server, and best-effort opens an inbound Windows Firewall rule for the dev
# port (default 3000) so the first connection from the phone isn't silently
# dropped. Firewall changes need an elevated shell -- if this process isn't
# elevated the script says so and prints the one command to run once by hand,
# rather than failing the dev launch.
#
# Usage:
#   .\scripts\lan-bridge.ps1            # port 3000
#   .\scripts\lan-bridge.ps1 -Port 3001
#   npm run dev:lan                     # runs this, then `next dev -H 0.0.0.0`

param(
  [int]$Port = 3000
)

$ErrorActionPreference = "Continue"

function Get-LanIPv4 {
  # Prefer a real private-range address on an "Up" adapter, skip virtual/WSL/loopback.
  $candidates = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and
      $_.PrefixOrigin -ne 'WellKnown' -and
      (Get-NetAdapter -InterfaceIndex $_.InterfaceIndex -ErrorAction SilentlyContinue).Status -eq 'Up'
    }
  $preferred = $candidates | Where-Object {
    (Get-NetAdapter -InterfaceIndex $_.InterfaceIndex -ErrorAction SilentlyContinue).Name -notmatch 'vEthernet|WSL|VirtualBox|VMware|Loopback'
  }
  $pick = if ($preferred) { $preferred } else { $candidates }
  ($pick | Select-Object -First 1).IPAddress
}

$ip = Get-LanIPv4
$ruleName = "UNITAS web dev ($Port)"

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)

if ($isAdmin) {
  try {
    if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
      New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow `
        -Protocol TCP -LocalPort $Port -Profile Private -ErrorAction Stop | Out-Null
      Write-Host "[lan-bridge] Firewall: opened inbound TCP $Port on the Private profile." -ForegroundColor Green
    } else {
      Write-Host "[lan-bridge] Firewall: rule '$ruleName' already present." -ForegroundColor DarkGray
    }
  } catch {
    Write-Host "[lan-bridge] Firewall rule could not be added: $($_.Exception.Message)" -ForegroundColor Yellow
  }
} else {
  Write-Host "[lan-bridge] Not elevated -- skipping the firewall rule." -ForegroundColor Yellow
  Write-Host "[lan-bridge] To allow the phone through once, run this in an ADMIN PowerShell:" -ForegroundColor Yellow
  Write-Host "  New-NetFirewallRule -DisplayName '$ruleName' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -Profile Private" -ForegroundColor Gray
}

Write-Host ""
if ($ip) {
  Write-Host "  ==> On your phone (same Wi-Fi), open:  http://$($ip):$Port" -ForegroundColor Cyan
} else {
  Write-Host "  ==> Could not auto-detect a LAN IPv4. Run 'ipconfig' and use the Wi-Fi adapter's IPv4 address: http://<that-ip>:$Port" -ForegroundColor Yellow
}
Write-Host ""
