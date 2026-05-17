import { Game, Platform } from '../types/game'

interface EpicManifest {
    DisplayName: string
    InstallLocation: string
    LaunchExecutable: string
    AppName: string
    CatalogNamespace: string
    CatalogItemId: string
    MainGameAppName?: string
    bIsIncompleteInstall?: boolean
}

export async function detectEpicGames(): Promise<Game[]> {
    const games: Game[] = []

    try {
        console.log('Epic: Starting detection...')

        // Get environment variables
        const programData = await window.electronAPI.getEnv('PROGRAMDATA')
        console.log('Epic: ProgramData env:', programData)

        // Primary manifest location
        const manifestsPath = `${programData}\\Epic\\EpicGamesLauncher\\Data\\Manifests`
        console.log('Epic: Checking path:', manifestsPath)

        const pathExists = await window.electronAPI.exists(manifestsPath)
        console.log('Epic: Path exists:', pathExists)

        if (!pathExists) {
            console.log('Epic: Manifests path does not exist')
            return games
        }

        const allFiles = await window.electronAPI.readDir(manifestsPath)
        console.log('Epic: All files in folder:', allFiles)

        // Filter for .item files
        const manifestFiles = allFiles.filter(f => f.endsWith('.item'))
        console.log('Epic: Found .item files:', manifestFiles)

        for (const manifestFile of manifestFiles) {
            const manifestPath = `${manifestsPath}\\${manifestFile}`
            console.log('Epic: Reading manifest:', manifestPath)

            const manifestContent = await window.electronAPI.readFile(manifestPath)

            if (!manifestContent) {
                console.log('Epic: Could not read file content')
                continue
            }

            console.log('Epic: File content length:', manifestContent.length)

            try {
                const manifest: EpicManifest = JSON.parse(manifestContent)
                console.log('Epic: Parsed manifest:', {
                    DisplayName: manifest.DisplayName,
                    AppName: manifest.AppName,
                    MainGameAppName: manifest.MainGameAppName,
                    bIsIncompleteInstall: manifest.bIsIncompleteInstall
                })

                // Skip DLC (only if MainGameAppName is set AND different from AppName)
                if (manifest.MainGameAppName && manifest.MainGameAppName !== manifest.AppName) {
                    console.log('Epic: Skipping DLC:', manifest.DisplayName)
                    continue
                }

                const incomplete = Boolean(manifest.bIsIncompleteInstall)

                // Skip if no display name
                if (!manifest.DisplayName) {
                    console.log('Epic: Skipping - no display name')
                    continue
                }

                console.log('Epic: ADDING GAME:', manifest.DisplayName)

                games.push({
                    id: `epic_${manifest.AppName}`,
                    name: manifest.DisplayName,
                    platform: 'epic' as Platform,
                    installPath: incomplete ? undefined : manifest.InstallLocation,
                    launchCommand: `com.epicgames.launcher://apps/${encodeURIComponent(manifest.CatalogNamespace)}%3A${encodeURIComponent(manifest.CatalogItemId)}%3A${encodeURIComponent(manifest.AppName)}?action=launch&silent=true`,
                    epicAppName: manifest.AppName,
                    epicCatalogNamespace: manifest.CatalogNamespace,
                    epicCatalogItemId: manifest.CatalogItemId,
                    isInstalled: !incomplete,
                    addedDate: new Date().toISOString()
                })
            } catch (parseError) {
                console.error('Epic: JSON parse error for', manifestFile, parseError)
            }
        }

        console.log('Epic: Detection complete. Found', games.length, 'games')
    } catch (error) {
        console.error('Epic: Detection error:', error)
    }

    return games
}
