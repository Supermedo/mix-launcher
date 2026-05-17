# Close Unified Launcher / Electron, then remove build output.
# Run from project root: powershell -ExecutionPolicy Bypass -File scripts/clean-dist.ps1

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Get-Process -Name "electron", "Unified Launcher", "Unified-Launcher-Portable" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Stop stray Vite dev servers for this project (port 5175)
Get-NetTCPConnection -LocalPort 5175 -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

foreach ($dir in @("dist", "dist-renderer", "dist-electron", ".vite-cache", "node_modules\.vite")) {
    $path = Join-Path $root $dir
    if (Test-Path $path) {
        Write-Host "Removing $dir ..."
        Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
        if (Test-Path $path) {
            Write-Warning "Could not remove $dir (files still in use). Close File Explorer and any app from release-build/, then retry."
        } else {
            Write-Host "Removed $dir"
        }
    }
}

Write-Host "Done."
