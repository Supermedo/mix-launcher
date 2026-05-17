# Downloads the Windows legendary.exe into resources/legendary for electron-builder packaging.
$ErrorActionPreference = 'Stop'
$outDir = Join-Path $PSScriptRoot '..\resources\legendary'
$outFile = Join-Path $outDir 'legendary.exe'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Write-Host 'Fetching latest Legendary release from GitHub...'
$release = Invoke-RestMethod -Uri 'https://api.github.com/repos/legendary-gl/legendary/releases/latest' -Headers @{
    'User-Agent' = 'Unified-Launcher-Build'
}

$asset = $release.assets | Where-Object {
    $_.name -match 'legendary.*\.exe$' -or $_.name -eq 'legendary.exe'
} | Select-Object -First 1

if (-not $asset) {
    throw 'No Windows .exe asset found on latest Legendary release.'
}

Write-Host "Downloading $($asset.name) ..."
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $outFile -UseBasicParsing
Write-Host "Saved to $outFile"
