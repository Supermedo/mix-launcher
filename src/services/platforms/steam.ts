import { Game, Platform } from '../types/game'

// Improved VDF parser for Steam's format
export function parseVDF(content: string): Record<string, any> {
    const result: Record<string, any> = {}

    try {
        const lines = content.split(/\r?\n/)
        const stack: { obj: Record<string, any>, key?: string }[] = [{ obj: result }]
        let pendingKey: string | null = null

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim()
            if (!line) continue

            // Match key-value pair: "key" "value" (handles escaped quotes)
            const kvMatch = line.match(/^"([^"]+)"\s+"((?:[^"\\]|\\.)*)"\s*$/)
            if (kvMatch) {
                const current = stack[stack.length - 1].obj
                // Unescape backslashes
                current[kvMatch[1].toLowerCase()] = kvMatch[2].replace(/\\\\/g, '\\')
                pendingKey = null
                continue
            }

            // Match standalone key: "key"
            const keyMatch = line.match(/^"([^"]+)"\s*$/)
            if (keyMatch) {
                pendingKey = keyMatch[1].toLowerCase()
                continue
            }

            // Opening brace
            if (line === '{') {
                const current = stack[stack.length - 1].obj
                if (pendingKey) {
                    const newObj: Record<string, any> = {}
                    current[pendingKey] = newObj
                    stack.push({ obj: newObj, key: pendingKey })
                    pendingKey = null
                }
                continue
            }

            // Closing brace
            if (line === '}') {
                if (stack.length > 1) {
                    stack.pop()
                }
                pendingKey = null
                continue
            }
        }
    } catch (error) {
        console.error('VDF parse error:', error)
    }

    return result
}

export async function detectSteamGames(): Promise<Game[]> {
    const games: Game[] = []

    try {
        console.log('Starting Steam detection...')

        const steamPaths: string[] = []

        const registryPath = await window.electronAPI.readRegistry(
            'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Valve\\Steam',
            'InstallPath'
        )
        if (registryPath) steamPaths.push(registryPath)

        const userRegistryPath = await window.electronAPI.readRegistry(
            'HKEY_CURRENT_USER\\SOFTWARE\\Valve\\Steam',
            'SteamPath'
        )
        if (userRegistryPath) {
            const normalizedPath = userRegistryPath.replace(/\//g, '\\')
            if (!steamPaths.includes(normalizedPath)) steamPaths.push(normalizedPath)
        }

        let steamPath: string | null = null
        for (const path of steamPaths) {
            if (await window.electronAPI.exists(path)) {
                const vdfPath = `${path}\\steamapps\\libraryfolders.vdf`
                if (await window.electronAPI.exists(vdfPath)) {
                    steamPath = path
                    break
                }
            }
        }

        // Only sweep drives if registry did not find Steam
        if (!steamPath) {
            const driveLetters = ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']
            const candidates: string[] = []
            for (const drive of driveLetters) {
                candidates.push(
                    `${drive}:\\Program Files (x86)\\Steam`,
                    `${drive}:\\Program Files\\Steam`,
                    `${drive}:\\Steam`,
                    `${drive}:\\SteamLibrary`
                )
            }
            for (const path of candidates) {
                if (await window.electronAPI.exists(path)) {
                    const vdfPath = `${path}\\steamapps\\libraryfolders.vdf`
                    if (await window.electronAPI.exists(vdfPath)) {
                        steamPath = path
                        break
                    }
                }
            }
        }

        if (!steamPath) {
            console.log('Steam not found')
            return games
        }

        // Read library folders
        const libraryFoldersPath = `${steamPath}\\steamapps\\libraryfolders.vdf`
        console.log('Reading:', libraryFoldersPath)
        const libraryFoldersContent = await window.electronAPI.readFile(libraryFoldersPath)

        if (!libraryFoldersContent) {
            console.log('Could not read libraryfolders.vdf')
            return games
        }

        const libraryPaths: string[] = []
        const libraryData = parseVDF(libraryFoldersContent)

        if (libraryData.libraryfolders) {
            for (const key of Object.keys(libraryData.libraryfolders)) {
                const folder = libraryData.libraryfolders[key]
                if (folder && typeof folder === 'object' && folder.path) {
                    const libPath = folder.path
                    if (!libraryPaths.includes(libPath)) libraryPaths.push(libPath)
                }
            }
        }

        if (!libraryPaths.includes(steamPath)) {
            libraryPaths.unshift(steamPath)
        }

        const parseManifest = (manifestContent: string, steamappsPath: string): Game | null => {
            const manifest = parseVDF(manifestContent)
            const appState = manifest.appstate
            if (!appState?.name || !appState?.appid) return null

            const nameLower = appState.name.toLowerCase()
            if (
                nameLower.includes('redistributable') ||
                nameLower.includes('proton') ||
                nameLower.includes('steamworks') ||
                nameLower.includes('steam linux runtime') ||
                nameLower.includes('directx') ||
                nameLower.includes('vcredist')
            ) {
                return null
            }

            const appId = appState.appid
            return {
                id: `steam_${appId}`,
                name: appState.name,
                platform: 'steam' as Platform,
                installPath: `${steamappsPath}\\common\\${appState.installdir}`,
                launchCommand: `steam://rungameid/${appId}`,
                coverUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
                backgroundUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_hero.jpg`,
                addedDate: new Date().toISOString()
            }
        }

        const MANIFEST_BATCH = 16
        for (const libPath of libraryPaths) {
            const steamappsPath = `${libPath}\\steamapps`
            if (!(await window.electronAPI.exists(steamappsPath))) continue

            const files = await window.electronAPI.readDir(steamappsPath)
            const manifestFiles = files.filter(f => f.startsWith('appmanifest_') && f.endsWith('.acf'))

            for (let i = 0; i < manifestFiles.length; i += MANIFEST_BATCH) {
                const batch = manifestFiles.slice(i, i + MANIFEST_BATCH)
                const parsed = await Promise.all(
                    batch.map(async manifestFile => {
                        const manifestContent = await window.electronAPI.readFile(
                            `${steamappsPath}\\${manifestFile}`
                        )
                        if (!manifestContent) return null
                        return parseManifest(manifestContent, steamappsPath)
                    })
                )
                for (const game of parsed) {
                    if (game) games.push(game)
                }
            }
        }

        console.log(`Steam detection complete. Found ${games.length} games.`)
    } catch (error) {
        console.error('Error detecting Steam games:', error)
    }

    return games
}
