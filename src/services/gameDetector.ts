import { Game } from '../types/game'
import { resolveLaunchCommand } from '../utils/launchBehavior'
import { detectSteamGames } from './platforms/steam'
import { detectEpicGames } from './platforms/epic'
import { detectEAGames } from './platforms/ea'
import { detectUbisoftGames } from './platforms/ubisoft'
import { detectGOGGames } from './platforms/gog'
import { detectAmazonGames } from './platforms/amazon'
import { detectXboxGames } from './platforms/xbox'
import { detectCloudGames } from './platforms/cloud'

export async function detectAllGames(): Promise<Game[]> {
    console.log('Starting game detection...')

    const results = await Promise.allSettled([
        detectSteamGames(),
        detectEpicGames(),
        detectEAGames(),
        detectUbisoftGames(),
        detectGOGGames(),
        detectAmazonGames(),
        detectXboxGames(),
        detectCloudGames()
    ])

    const allGames: Game[] = []

    for (const result of results) {
        if (result.status === 'fulfilled') {
            allGames.push(...result.value)
        } else {
            console.error('Platform detection failed:', result.reason)
        }
    }

    console.log(`Detected ${allGames.length} games`)
    return allGames
}

export async function launchGame(game: Game): Promise<boolean> {
    if (!window.electronAPI?.launchGame) {
        console.error('Launch not available (missing Electron API)')
        return false
    }
    const command = resolveLaunchCommand(game).trim()
    if (!command) {
        console.error('No launch command for', game.name)
        return false
    }
    try {
        if (game.platform === 'cloud' && /^https?:\/\//i.test(command)) {
            if (window.electronAPI?.openCloudFullscreen) {
                return await window.electronAPI.openCloudFullscreen(command, game.name)
            }
        }
        if (command.startsWith('epic-launcher:install:')) {
            const appName = command.slice('epic-launcher:install:'.length)
            if (window.electronAPI?.epicOpenInLauncher) {
                return await window.electronAPI.epicOpenInLauncher({
                    appName,
                    namespace: game.epicCatalogNamespace,
                    catalogItemId: game.epicCatalogItemId,
                    install: true
                })
            }
        }
        if (command.startsWith('gog-galaxy:install:')) {
            const uri = command.slice('gog-galaxy:install:'.length)
            if (window.electronAPI?.gogOpenInGalaxy) {
                return await window.electronAPI.gogOpenInGalaxy({
                    uri,
                    releaseKey: game.gogReleaseKey,
                    productId: game.gogProductId || game.id.replace(/^gog_/, '')
                })
            }
        }
        if (command.startsWith('legendary:install:')) {
            const appName = command.slice('legendary:install:'.length)
            if (window.electronAPI?.legendaryInstall) {
                return await window.electronAPI.legendaryInstall(appName)
            }
        }
        if (command.startsWith('legendary:launch:')) {
            const appName = command.slice('legendary:launch:'.length)
            if (window.electronAPI?.legendaryLaunch) {
                return await window.electronAPI.legendaryLaunch(appName)
            }
        }
        return await window.electronAPI.launchGame(command, game.launchArgs)
    } catch (error) {
        console.error('Failed to launch game:', error)
        return false
    }
}

export * from './platforms/steam'
export * from './platforms/epic'
export * from './platforms/ea'
export * from './platforms/ubisoft'
export * from './platforms/gog'
export * from './platforms/amazon'
export * from './platforms/xbox'
export * from './platforms/cloud'
export * from './platforms/manual'
