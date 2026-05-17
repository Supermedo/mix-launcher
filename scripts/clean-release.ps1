# Clears release/ before electron-builder. Fixes "Access is denied" on chrome_*.pak.
# Run: powershell -ExecutionPolicy Bypass -File scripts/clean-release.ps1

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
# Must match package.json build.directories.output
$release = Join-Path $root 'release-build'
$legacyRelease = Join-Path $root 'release'

Write-Host 'Stopping launcher / Electron processes...'
$names = @(
    'electron',
    'Mix Launcher',
    'Mix-Launcher-Portable',
    'Unified Launcher',
    'Unified-Launcher-Portable',
    'app-builder',
    'app-builder-bin'
)
foreach ($name in $names) {
    Get-Process -Name $name -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
        $_.ExecutablePath -and (
            $_.ExecutablePath -like "*unified-launcher*" -or
            $_.ExecutablePath -like "*win-unpacked*"
        )
    } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 2

function Clear-ReleaseDir([string]$dir) {
    if (-not (Test-Path $dir)) {
        return $true
    }
    Write-Host "Clearing $dir ..."
    $empty = Join-Path $env:TEMP "empty-dir-$(Get-Random)"
    New-Item -ItemType Directory -Path $empty -Force | Out-Null
    & robocopy $empty $dir /MIR /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
    Remove-Item -LiteralPath $empty -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
    return -not (Test-Path $dir)
}

$ok = Clear-ReleaseDir $release
if (-not $ok) {
    Write-Host ''
    Write-Warning "Could not remove $release"
    Write-Host 'Close Mix Launcher (tray), File Explorer on release-build, then retry.'
    Write-Host 'Or reboot and delete the folder manually.'
    exit 1
}

if (Test-Path $legacyRelease) {
    Write-Host ''
    Write-Host 'Note: Old release/ still exists (may be locked). You can delete it later after closing the app.'
    Write-Host 'Builds now use release-build/ — see package.json.'
}

Write-Host 'release-build/ cleared successfully.'
exit 0
