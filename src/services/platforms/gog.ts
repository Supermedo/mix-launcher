import { Game, Platform } from '../types/game'

export async function detectGOGGames(): Promise<Game[]> {
    const games: Game[] = []

    try {
        // GOG Galaxy stores database in AppData
        const localAppData = await window.electronAPI.getEnv('LOCALAPPDATA')
        const programData = await window.electronAPI.getEnv('PROGRAMDATA')

        // Check registry for installed GOG games
        const registryPaths = [
            'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\GOG.com\\Games',
            'HKEY_LOCAL_MACHINE\\SOFTWARE\\GOG.com\\Games'
        ]

        for (const regPath of registryPaths) {
            const regContent = await window.electronAPI.readAllRegistryValues(regPath)

            if (regContent) {
                // Parse registry to find games
                const lines = regContent.split('\n')
                let currentGameId: string | null = null
                let currentGameName: string | null = null
                let currentInstallPath: string | null = null

                for (const line of lines) {
                    // Look for game ID subkey
                    const subkeyMatch = line.match(/GOG\.com\\Games\\(\d+)/i)
                    if (subkeyMatch) {
                        // Save previous game if complete
                        if (currentGameId && currentGameName && currentInstallPath) {
                            games.push({
                                id: `gog_${currentGameId}`,
                                name: currentGameName,
                                platform: 'gog' as Platform,
                                gogProductId: currentGameId,
                                installPath: currentInstallPath,
                                launchCommand: `goggalaxy://openGameView/${currentGameId}`,
                                isInstalled: true,
                                addedDate: new Date().toISOString()
                            })
                        }

                        currentGameId = subkeyMatch[1]
                        currentGameName = null
                        currentInstallPath = null
                        continue
                    }

                    // Look for game name
                    const nameMatch = line.match(/gameName\s+REG_SZ\s+(.+)/i) ||
                        line.match(/GAMENAME\s+REG_SZ\s+(.+)/i)
                    if (nameMatch && currentGameId) {
                        currentGameName = nameMatch[1].trim()
                        continue
                    }

                    // Look for install path
                    const pathMatch = line.match(/path\s+REG_SZ\s+(.+)/i) ||
                        line.match(/PATH\s+REG_SZ\s+(.+)/i)
                    if (pathMatch && currentGameId) {
                        currentInstallPath = pathMatch[1].trim()
                        continue
                    }
                }

                // Don't forget the last game
                if (currentGameId && currentGameName && currentInstallPath) {
                    games.push({
                        id: `gog_${currentGameId}`,
                        name: currentGameName,
                        platform: 'gog' as Platform,
                        gogProductId: currentGameId,
                        installPath: currentInstallPath,
                        launchCommand: `goggalaxy://openGameView/${currentGameId}`,
                        isInstalled: true,
                        addedDate: new Date().toISOString()
                    })
                }
            }
        }

        // Also scan common GOG installation directories
        const commonGOGPaths = [
            'C:\\Program Files (x86)\\GOG Galaxy\\Games',
            'C:\\Program Files\\GOG Galaxy\\Games',
            'C:\\GOG Games',
            'D:\\GOG Games',
            'D:\\Games\\GOG',
            'E:\\GOG Games'
        ]

        for (const gogPath of commonGOGPaths) {
            if (await window.electronAPI.exists(gogPath)) {
                const folders = await window.electronAPI.readDir(gogPath)

                for (const folder of folders) {
                    // Skip if already found
                    if (games.some(g => g.name.toLowerCase() === folder.toLowerCase())) continue

                    const gamePath = `${gogPath}\\${folder}`

                    // Check for goggame-*.info file
                    const files = await window.electronAPI.readDir(gamePath)
                    const infoFile = files.find(f => f.startsWith('goggame-') && f.endsWith('.info'))

                    if (infoFile) {
                        const infoPath = `${gamePath}\\${infoFile}`
                        const infoContent = await window.electronAPI.readFile(infoPath)

                        if (infoContent) {
                            try {
                                const info = JSON.parse(infoContent)
                                const gameId = info.gameId || infoFile.replace('goggame-', '').replace('.info', '')

                                games.push({
                                    id: `gog_${gameId}`,
                                    name: info.name || folder,
                                    platform: 'gog' as Platform,
                                    gogProductId: String(gameId),
                                    installPath: gamePath,
                                    launchCommand: `goggalaxy://openGameView/${gameId}`,
                                    isInstalled: true,
                                    addedDate: new Date().toISOString()
                                })
                            } catch (e) {
                                // If JSON parsing fails, add with folder name
                                games.push({
                                    id: `gog_${folder.replace(/\s+/g, '_')}`,
                                    name: folder,
                                    platform: 'gog' as Platform,
                                    installPath: gamePath,
                                    launchCommand: `goggalaxy://openGameView/${folder}`,
                                    isInstalled: true,
                                    addedDate: new Date().toISOString()
                                })
                            }
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error detecting GOG games:', error)
    }

    return games
}
