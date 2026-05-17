# Scans installed Xbox / Microsoft Store / PC Game Pass titles for Unified Launcher
$ErrorActionPreference = 'SilentlyContinue'
$results = @{}

function Add-Entry($name, $appId, $installPath) {
    if ([string]::IsNullOrWhiteSpace($name) -or [string]::IsNullOrWhiteSpace($appId)) { return }
    if ($name -match '^ms-resource:') { return }
    if ($appId -match 'immersivecontrolpanel|AccountsControl|ParentalControls|CredDialogHost|WebExperienceHost') { return }
    if ($appId -match 'WindowsInstallationAssistant|OneDriveSetup|Edge\\Application|DisplayIcon') { return }
    $key = $appId.ToLower().Trim()
    if (-not $results.ContainsKey($key)) {
        $results[$key] = [PSCustomObject]@{
            Name        = $name.Trim()
            AppId       = $appId.Trim()
            InstallPath = $installPath
        }
    }
}

$excludePackages = @(
    'Microsoft.GamingApp', 'Microsoft.XboxGamingOverlay', 'Microsoft.XboxGameCallableUI',
    'Microsoft.XboxSpeechToTextOverlay', 'Microsoft.XboxIdentityProvider', 'Microsoft.Xbox.TCUI',
    'Microsoft.WindowsStore', 'Microsoft.StorePurchaseApp', 'Microsoft.Windows.Photos',
    'Microsoft.WindowsCamera', 'Microsoft.WindowsCalculator', 'Microsoft.WindowsAlarms',
    'Microsoft.WindowsSoundRecorder', 'Microsoft.MicrosoftEdge', 'Microsoft.MicrosoftEdge.Stable',
    'Microsoft.ScreenSketch', 'Microsoft.GetHelp', 'Microsoft.Getstarted', 'Microsoft.YourPhone',
    'Microsoft.ZuneVideo', 'Microsoft.ZuneMusic', 'Microsoft.MicrosoftSolitaireCollection',
    'Microsoft.WindowsTerminal', 'Microsoft.WindowsNotepad', 'Microsoft.Paint',
    'Microsoft.OutlookForWindows', 'MicrosoftTeams', 'Microsoft.Todos', 'Microsoft.PowerAutomateDesktop',
    'Microsoft.Copilot', 'Microsoft.GamingServices', 'Microsoft.BingNews', 'Microsoft.BingWeather',
    'Microsoft.Windows.ParentalControls', 'Microsoft.AccountsControl', 'Microsoft.CredDialogHost',
    'windows.immersivecontrolpanel', 'Microsoft.Windows.CloudExperienceHost'
)

$utilityPublishers = 'Realtek|NVIDIA Corp|DTS|ASUSTeK|Armoury|Razer|Logitech|Intel|AMD|Synaptics'

# 1) AppX packages — primary source for Game Pass / Store installs
Get-AppxPackage -PackageTypeFilter Main, Bundle | Where-Object {
    $_.InstallLocation -and -not $_.IsFramework -and ($excludePackages -notcontains $_.Name)
} | ForEach-Object {
    $pfn = $_.PackageFamilyName
    if (-not $pfn) { return }
    $appId = "$pfn!App"
    $display = $_.Name
    try {
        $manifest = Get-AppxPackageManifest $_ -ErrorAction SilentlyContinue
        $dn = $manifest.Package.Properties.DisplayName
        if ($dn -and $dn -notmatch '^@\{' -and $dn.Length -gt 1) { $display = $dn }
    } catch {}

    $publisher = $_.Publisher
    if ($publisher -match $utilityPublishers) { return }
    if ($_.Name -match '^(NVIDIACorp\.|Realtek|DTSInc\.|Microsoft\.GamingServices)') { return }

    $isGame = $false
    if ($_.InstallLocation -match 'XboxGames') { $isGame = $true }
    if ($publisher -match 'Xbox Game Studios|Bethesda|Activision|Blizzard|Electronic Arts|Ubisoft|SEGA|Square Enix|2K|Warner|Devolver|Focus|Team17|343 Industries|Playground|Ninja Theory|Obsidian|inXile|Compulsion|Crystal Dynamics|IO Interactive|Undead Labs|Rare|Turn 10|The Coalition|Annapurna|Kalypso|Deep Silver|Bandai|Capcom|Konami|Hideo|FromSoftware|CD Projekt|Rockstar|Take-Two|Techland|Kepler|Larian|Hello Games|Facepunch|Studio Wildcard|Grinding Gear|Psyonix|Epic Games') { $isGame = $true }
    if ($_.Name -match 'Game|Gaming|Forza|Halo|Minecraft|Starfield|Gears|Fable|AgeOf|Doom|Fallout|Ori|Cuphead|Fortnite|Palworld|SeaOf|Diablo|CallOfDuty|Overwatch|Warcraft|Assassin|FarCry|Rainbow|Ghost|Division|Anno|FlightSimulator|MSFS|Hades|Hi-Fi|Avowed|Hellblade|Psychonauts|Control|Remedy|Armored|Tekken|StreetFighter|ResidentEvil|MonsterHunter|Dragon|FinalFantasy|Yakuza|Persona|Metaphor|SilentHill|MetalGear|DeathStranding|Horizon|Spider|Helldivers|Destiny|Borderlands|Warhammer|TotalWar|Civilization|AgeOf|Commandos|Mixtape|Palworld|Starfield|Indiana|StarWars|Marvel|Lego|NBA|FIFA|FC\d|NHL|Madden|F1|WRC|Dirt|Grid|Outer|Grounded|Pentiment|LikeADragon|Judgment|LostJudgment|WoLong|Nioh|Elden|DarkSouls|Sekiro|ArmoredCore|LiesofP|BlackMyth|StellarBlade|Atlas|PAYDAY|CrimeBoss|Sniper|Hitman|TombRaider|DeusEx|Thief|Dishonored|Prey|Bioshock|XCOM|Cities|Planet|Civilization|Crusader|TotalWar|Warhammer|AgeOf|CompanyOf|HeartsOf|Stronghold|Civilization') { $isGame = $true }

    if ($isGame) {
        Add-Entry $display $appId $_.InstallLocation
    }
}

# 2) XboxGames folders on all drives — match to StartApps for real AppID
$startApps = @(Get-StartApps)
Get-PSDrive -PSProvider FileSystem | ForEach-Object {
    $root = Join-Path $_.Root 'XboxGames'
    if (-not (Test-Path -LiteralPath $root)) { return }
    Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $dirName = $_.Name
        if ($dirName -match '^(Temp|Cache|GameSave)$') { return }
        $match = $startApps | Where-Object { $_.Name -ieq $dirName -and $_.AppID -match '!' } | Select-Object -First 1
        if ($match -and $match.AppID) {
            Add-Entry $match.Name $match.AppID $_.FullName
        }
    }
}

# 3) Start menu entries that look like games (strict)
$startBlock = 'Settings|Store|Xbox$|Calculator|Camera|Photos|Snipping|Paint$|Notepad|Terminal|Explorer|Security|Solitaire|Clipchamp|Copilot|Phone|Feedback|Media Player|Mail|Calendar|Maps|Weather|Tips|Edge$|Sticky|Sound Recorder|Clock|Alarms|Voice|Family|Widgets|Cortana|OneNote|Outlook|Teams|To Do|PowerShell|Control Panel|NVIDIA|Realtek|DTS|Armoury|Quick Assist|Game Bar|Get Started|Click to Do|News|Claude|Power Automate|Gaming Services|Audio|Assist|Hub|Panel|Processing|Installation Assistant|OneDrive'

Get-StartApps | ForEach-Object {
    $name = $_.Name
    $appId = $_.AppID
    if ([string]::IsNullOrWhiteSpace($appId) -or $appId -notmatch '!') { return }
    if ($name -match $startBlock) { return }
    if ($name -match '^(Microsoft|Windows)\s') { return }
    if ($appId -match 'Microsoft\.(Windows|Zune|YourPhone|GetHelp|ScreenSketch|WindowsStore|GamingServices|XboxGamingOverlay|PowerShell|BingNews|BingWeather|PowerAutomate|Copilot)') { return }
    if ($appId -match 'GamingApp_') { return }
    if ($appId -notmatch 'Game|Forza|Halo|Minecraft|Bethesda|Activision|Blizzard|Ubisoft|SEGA|Square|2K|Warner|Devolver|Playground|Obsidian|inXile|Rare|Flight|Simulator|Commandos|Mixtape|Palworld|Starfield|Gears|Fable|Doom|Fallout|Diablo|CallOf|Overwatch|Assassin|FarCry|Rainbow|Anno|Kalypso|Annapurna|Larian|HelloGames|Psyonix|Studio|Wild|Facepunch|Grinding|Epic') {
        return
    }
    Add-Entry $name $appId $null
}

# 4) Uninstall registry — only real game publishers with valid exe
$uninstallPaths = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
foreach ($path in $uninstallPaths) {
    Get-ItemProperty $path -ErrorAction SilentlyContinue | ForEach-Object {
        if (-not $_.DisplayName) { return }
        $pub = $_.Publisher
        if ($pub -notmatch 'Xbox Game Studios|Bethesda|Activision|Blizzard|Electronic Arts|Ubisoft|SEGA|Square Enix|2K|Warner|Microsoft Studios') { return }
        if ($_.DisplayName -match 'Visual C\+\+|Redistributable|SDK|Runtime|DirectX|Update|Launcher$|^EA app$') { return }
        if ($_.InstallLocation -match 'Package Cache') { return }
        $launch = $null
        if ($_.DisplayIcon -match '^\"?([A-Za-z]:\\.+\.exe)') {
            $launch = $Matches[1]
        } elseif ($_.InstallLocation -and (Test-Path -LiteralPath $_.InstallLocation)) {
            $exe = Get-ChildItem -LiteralPath $_.InstallLocation -Filter '*.exe' -Recurse -Depth 2 -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -notmatch 'unins|setup|crash|redist|launcher' } |
                Select-Object -First 1
            if ($exe) { $launch = $exe.FullName }
        }
        if ($launch -and (Test-Path -LiteralPath $launch)) {
            Add-Entry $_.DisplayName $launch $_.InstallLocation
        }
    }
}

@($results.Values) | ConvertTo-Json -Compress -Depth 4
