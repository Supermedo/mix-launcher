import { Game, Platform } from '../../types/game'

export async function detectUbisoftGames(): Promise<Game[]> {
    const games: Game[] = []

    try {
        console.log('Detecting Ubisoft games...')

        // Check registry for Ubisoft Connect installation
        const ubisoftPath = await window.electronAPI.readRegistry(
            'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher',
            'InstallDir'
        )
        console.log('Ubisoft Connect path from registry:', ubisoftPath)

        // Common Ubisoft installation paths
        const installPaths = [
            'C:\\Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\games',
            'C:\\Program Files\\Ubisoft\\Ubisoft Game Launcher\\games',
            'D:\\Ubisoft\\Ubisoft Game Launcher\\games',
            'D:\\Games\\Ubisoft',
            'E:\\Ubisoft\\Ubisoft Game Launcher\\games',
            'C:\\Ubisoft\\Ubisoft Game Launcher\\games',
            'D:\\Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\games',
            'E:\\Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\games'
        ]

        if (ubisoftPath) {
            installPaths.unshift(`${ubisoftPath}\\games`)
            installPaths.unshift(ubisoftPath)
        }

        // Method 1: Scan registry for installed games - most reliable
        const registryKeys = [
            'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs',
            'HKEY_LOCAL_MACHINE\\SOFTWARE\\Ubisoft\\Launcher\\Installs',
            'HKEY_CURRENT_USER\\SOFTWARE\\Ubisoft\\Launcher\\Installs'
        ]

        for (const regKey of registryKeys) {
            console.log('Checking Ubisoft registry:', regKey)
            const regContent = await window.electronAPI.readAllRegistryValues(regKey)

            if (regContent) {
                console.log('Found Ubisoft registry content:', regContent.substring(0, 500))

                // Parse registry output to find game IDs and paths
                const lines = regContent.split('\n')
                let currentGameId: string | null = null

                for (const line of lines) {
                    // Look for subkey (game ID)
                    const subkeyMatch = line.match(/HKEY_.*\\Installs\\(\d+)/i)
                    if (subkeyMatch) {
                        currentGameId = subkeyMatch[1]
                        console.log('Found Ubisoft game ID:', currentGameId)
                        continue
                    }

                    // Look for InstallDir value
                    if (currentGameId) {
                        const installMatch = line.match(/InstallDir\s+REG_SZ\s+(.+)/i)
                        if (installMatch) {
                            const installPath = installMatch[1].trim()
                            console.log('Found Ubisoft game path:', installPath)

                            // Get game name from folder
                            const folderName = installPath.split('\\').pop() || `Game ${currentGameId}`

                            // Check if not already added
                            if (!games.some(g => g.id === `ubisoft_${currentGameId}`)) {
                                games.push({
                                    id: `ubisoft_${currentGameId}`,
                                    name: folderName,
                                    platform: 'ubisoft' as Platform,
                                    installPath: installPath,
                                    launchCommand: `uplay://launch/${currentGameId}/0`,
                                    addedDate: new Date().toISOString()
                                })
                                console.log('Added Ubisoft game:', folderName)
                            }

                            currentGameId = null
                        }
                    }
                }
            }
        }

        // Method 2: Also scan common directories for games not in registry
        for (const basePath of installPaths) {
            if (await window.electronAPI.exists(basePath)) {
                console.log('Scanning Ubisoft folder:', basePath)
                try {
                    const folders = await window.electronAPI.readDir(basePath)
                    console.log(`Found ${folders.length} items in ${basePath}`)

                    for (const folder of folders) {
                        // Skip if already found or is a system folder
                        if (games.some(g => g.name.toLowerCase() === folder.toLowerCase())) continue
                        if (folder.startsWith('.') || folder === 'cache' || folder === 'logs') continue

                        const gamePath = `${basePath}\\${folder}`

                        // Check for Ubisoft game indicators
                        const hasStateFile = await window.electronAPI.exists(`${gamePath}\\upc\\uplay_install.state`)
                        const files = await window.electronAPI.readDir(gamePath)
                        const hasExe = files.some(f => f.endsWith('.exe'))

                        if (hasStateFile || hasExe) {
                            // Generate a unique ID based on folder name
                            const gameId = folder.replace(/[^a-zA-Z0-9]/g, '_')

                            games.push({
                                id: `ubisoft_${gameId}`,
                                name: folder,
                                platform: 'ubisoft' as Platform,
                                installPath: gamePath,
                                launchCommand: `uplay://launch/${gameId}/0`,
                                addedDate: new Date().toISOString()
                            })
                            console.log('Added Ubisoft game from folder scan:', folder)
                        }
                    }
                } catch (e) {
                    console.log('Could not read folder:', basePath, e)
                }
            }
        }

        console.log(`Total Ubisoft games detected: ${games.length}`)
    } catch (error) {
        console.error('Error detecting Ubisoft games:', error)
    }

    return games
}
