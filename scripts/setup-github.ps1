# First-time Git + GitHub setup for Mix Launcher
# Run in PowerShell (works even if Cursor locks .git in the project folder):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-github.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$git = 'C:\Program Files\Git\bin\git.exe'

if (-not (Test-Path $git)) {
    Write-Host 'Git not found. Install: winget install Git.Git' -ForegroundColor Yellow
    exit 1
}

& $git config --global --add safe.directory $root 2>$null

# Publish from a clean copy so Cursor's .git/cursor lock does not block us
$publishRoot = Join-Path $env:TEMP 'mix-launcher-github'
if (Test-Path $publishRoot) {
    Write-Host "Removing old publish folder: $publishRoot"
    Remove-Item -Recurse -Force $publishRoot -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $publishRoot -Force | Out-Null

Write-Host "Copying project to $publishRoot (excluding node_modules and builds)..."
$exclude = @('node_modules', 'dist', 'dist-electron', '.git', 'release-build', 'release-build-fresh', 'release', 'release1', '.vite-cache')
robocopy $root $publishRoot /E /XD $exclude /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit $LASTEXITCODE" }

Set-Location $publishRoot
& $git config --global --add safe.directory $publishRoot 2>$null

Write-Host 'Initializing git repository...'
& $git init -b main
& $git add .

$stat = & $git diff --cached --shortstat
Write-Host "Staged: $stat"

$files = (& $git diff --cached --name-only | Measure-Object -Line).Lines
if ($files -gt 500) {
    Write-Warning "Too many files ($files). Aborting - check .gitignore."
    exit 1
}

$commitMsg = "Initial commit: Mix Launcher`n`nUnified Windows game launcher with multi-store library and Big Picture mode."
& $git -c user.name="Mix Launcher" -c user.email="mix-launcher@users.noreply.github.com" commit -m $commitMsg

Write-Host ''
Write-Host ('Repository ready at: ' + $publishRoot) -ForegroundColor Green
Write-Host ''
Write-Host 'Create repo on GitHub: https://github.com/new' -ForegroundColor Cyan
Write-Host '  Name: mix-launcher (do not add README or .gitignore on GitHub)'
Write-Host ''
Write-Host 'Then run:' -ForegroundColor Cyan
Write-Host "  cd `"$publishRoot`""
Write-Host '  git remote add origin https://github.com/YOUR_USER/mix-launcher.git'
Write-Host '  git push -u origin main'
Write-Host ''
Write-Host 'Optional: install GitHub CLI, run gh auth login, then gh repo create from this folder.' -ForegroundColor Cyan
