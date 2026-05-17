$ErrorActionPreference = 'SilentlyContinue'
Write-Host '=== XboxGames folders ==='
@('C:\XboxGames','D:\XboxGames','E:\XboxGames',"$env:ProgramFiles\XboxGames") | ForEach-Object {
    if (Test-Path -LiteralPath $_) {
        Write-Host "FOUND $_"
        Get-ChildItem -LiteralPath $_ -Directory | Select-Object -First 5 -ExpandProperty Name
    }
}
Write-Host '=== Gaming registry ==='
if (Test-Path 'HKLM:\SOFTWARE\Microsoft\Gaming\InstalledPackages') {
    (Get-ChildItem 'HKLM:\SOFTWARE\Microsoft\Gaming\InstalledPackages').Count
}
Write-Host '=== Sample StartApps (games) ==='
Get-StartApps | Where-Object { $_.AppID -match '!' } | Select-Object -First 20 Name, AppID
