<#
  OpenSEO keepalive at Windows sign-in (fork/DEPENDABILITY.md WO-B13-015, ADR-028, Ken action K1).

  WSL stops a distro when no session process is left; the OpenSEO app, its timers and the
  watchdog then stop with it. This installer writes one file in your Startup folder:
    %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\OpenSEO-keepalive.vbs
  which, at sign-in, runs hidden:  wsl.exe -d <distro> --exec /bin/sh -c "sleep infinity"
  User level only: no admin, no registry, no .wslconfig. Safe to run again (idempotent).

  Install:    powershell -NoProfile -ExecutionPolicy Bypass -File install-autostart.ps1 -Distro Ubuntu
  Uninstall:  powershell -NoProfile -ExecutionPolicy Bypass -File install-autostart.ps1 -Uninstall
#>
param(
  [string]$Distro = "Ubuntu",
  [switch]$Uninstall
)
$ErrorActionPreference = "Stop"

$startup = [Environment]::GetFolderPath("Startup")
$target = Join-Path $startup "OpenSEO-keepalive.vbs"

if ($Uninstall) {
  if (Test-Path $target) {
    Remove-Item $target
    Write-Output "removed $target"
  } else {
    Write-Output "nothing to remove ($target not found)"
  }
  exit 0
}

if ($Distro -notmatch '^[A-Za-z0-9._-]+$') {
  Write-Error "Distro name '$Distro' has unexpected characters."
  exit 1
}
$known = (& wsl.exe -l -q) -replace "`0", "" | ForEach-Object { $_.Trim() } | Where-Object { $_ }
if ($known -notcontains $Distro) {
  Write-Error "WSL distro '$Distro' not found. Installed: $($known -join ', ')"
  exit 1
}

# 0 = hidden window, False = do not wait.
$vbs = @"
' OpenSEO keepalive (fork/scripts/windows/install-autostart.ps1). Keeps WSL distro $Distro running.
CreateObject("WScript.Shell").Run "wsl.exe -d $Distro --exec /bin/sh -c ""sleep infinity""", 0, False
"@

if ((Test-Path $target) -and ((Get-Content -Raw $target) -eq $vbs)) {
  Write-Output "unchanged $target"
} else {
  Set-Content -Path $target -Value $vbs -Encoding ASCII -NoNewline
  Write-Output "wrote $target"
}
Write-Output "Takes effect at the next sign-in. To start it now: wscript.exe `"$target`""
