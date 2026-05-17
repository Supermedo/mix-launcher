import { Game, Platform } from '../types/game'
import { mergeLibraryWithInstalled } from './steamApi'

export interface LegendaryOwnedGame {
    app_name: string
    app_title?: string
    catalog_item_id?: string
    catalog_namespace?: string
}

export interface LegendaryInstalledGame {
    app_name: string
    install_path?: string
    version?: string
}

/** Install page in EGL (Playnite format). */
export function buildEpicInstallUri(appName: string): string {
    const app = appName.trim()
    if (!app) return ''
    return `com.epicgames.launcher://apps/${encodeURIComponent(app)}?action=install`
}

export function buildEpicLauncherUri(
    namespace: string,
    catalogItemId: string,
    appName: string,
    mode: 'launch' | 'install' = 'launch'
): string {
    if (mode === 'install') {
        return buildEpicInstallUri(appName)
    }
    const ns = namespace.trim()
    const cid = catalogItemId.trim()
    const app = appName.trim()
    if (ns && cid && app) {
        const encodedPath = [ns, cid, app].map(part => encodeURIComponent(part)).join('%3A')
        return `com.epicgames.launcher://apps/${encodedPath}?action=launch&silent=true`
    }
    if (app) {
        return `com.epicgames.launcher://apps/${encodeURIComponent(app)}?action=launch&silent=true`
    }
    return ''
}

export function legendaryEntryToGame(
    entry: LegendaryOwnedGame,
    installed?: LegendaryInstalledGame
): Game | null {
    const appName = entry.app_name?.trim()
    if (!appName) return null

    const namespace = (entry.catalog_namespace || (entry as { namespace?: string }).namespace)?.trim()
    const catalogItemId = entry.catalog_item_id?.trim()
    const hasCatalog = Boolean(namespace && catalogItemId)

    const launchCommand = hasCatalog
        ? buildEpicLauncherUri(namespace!, catalogItemId!, appName, 'launch')
        : `legendary:launch:${appName}`

    return {
        id: `epic_${appName}`,
        name: (entry.app_title || appName).trim(),
        platform: 'epic' as Platform,
        launchCommand,
        epicAppName: appName,
        epicCatalogNamespace: namespace,
        epicCatalogItemId: catalogItemId,
        installPath: installed?.install_path,
        isInstalled: Boolean(installed?.install_path),
        addedDate: new Date().toISOString()
    }
}

export function gamesFromLegendaryLibrary(
    owned: LegendaryOwnedGame[],
    installed: LegendaryInstalledGame[]
): Game[] {
    const installedByApp = new Map(installed.map(g => [g.app_name, g]))
    const games: Game[] = []

    for (const entry of owned) {
        const inst = installedByApp.get(entry.app_name)
        const game = legendaryEntryToGame(entry, inst)
        if (game) games.push(game)
    }

    return games
}

export function mergeEpicLibraryWithInstalled(cloudGames: Game[], localEpicGames: Game[]): Game[] {
    const cloudById = new Map(cloudGames.map(g => [g.id, g]))
    return mergeLibraryWithInstalled(cloudGames, localEpicGames).map(game => {
        if (game.platform !== 'epic') return game
        const cloud = cloudById.get(game.id)
        const ns = game.epicCatalogNamespace || cloud?.epicCatalogNamespace
        const cid = game.epicCatalogItemId || cloud?.epicCatalogItemId
        const app = game.epicAppName || cloud?.epicAppName
        if (!app || !ns || !cid) return game
        return {
            ...game,
            epicAppName: app,
            epicCatalogNamespace: ns,
            epicCatalogItemId: cid,
            launchCommand: buildEpicLauncherUri(ns, cid, app, 'launch')
        }
    })
}

export function parseLegendaryError(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error)
    if (/No saved credentials|Not signed in to Epic/i.test(raw)) {
        return 'Not signed in to Epic yet. Open Settings → Epic Games → Sign in to Epic, finish login, then Sync Library.'
    }
    if (raw.includes('Error invoking remote method')) {
        const match = raw.match(/Error: ([^\n]+)/)
        if (match?.[1] && !match[1].includes('Command failed')) {
            return match[1]
        }
        return 'Epic library sync failed. Sign in under Settings → Epic Games first.'
    }
    return raw
}

export async function fetchEpicLibraryFromLegendary(legendaryPath?: string): Promise<Game[]> {
    if (!window.electronAPI?.legendaryFetchLibrary) {
        throw new Error('Legendary integration is only available in the desktop app.')
    }

    const status = await window.electronAPI.legendaryStatus(legendaryPath)
    if (!status.available) {
        throw new Error(status.error || 'Epic sync tool is not available.')
    }
    if (!status.authenticated) {
        throw new Error(
            'Not signed in to Epic yet. Open Settings → Epic Games → Sign in to Epic, complete login, then Sync Library.'
        )
    }

    try {
        const { games, installed } = await window.electronAPI.legendaryFetchLibrary(legendaryPath)
        return gamesFromLegendaryLibrary(games, installed)
    } catch (error) {
        throw new Error(parseLegendaryError(error))
    }
}
