import { Game, Platform } from '../types/game'
import { mergeLibraryWithInstalled } from './steamApi'

export interface GogGalaxyOwnedGame {
    releaseKey: string
    productId: string
    title: string
}

/** Open a game in GOG Galaxy. Prefer library releaseKey (gog_<id>) — numeric id alone opens the store page. */
export function buildGogGalaxyUri(ids: { gogProductId?: string; gogReleaseKey?: string }): string {
    const releaseKey = (ids.gogReleaseKey || '').trim()
    if (releaseKey) return `goggalaxy://openGameView/${releaseKey}`
    const productId = (ids.gogProductId || '').trim()
    if (productId) return `goggalaxy://openGameView/${productId}`
    return ''
}

export function gogEntryToGame(entry: GogGalaxyOwnedGame, installed?: Game): Game {
    const productId = entry.productId.trim()
    return {
        id: `gog_${productId}`,
        name: entry.title.trim(),
        platform: 'gog' as Platform,
        gogProductId: productId,
        gogReleaseKey: entry.releaseKey,
        launchCommand: buildGogGalaxyUri({ gogReleaseKey: entry.releaseKey, gogProductId: productId }),
        installPath: installed?.installPath,
        isInstalled: Boolean(installed?.installPath),
        addedDate: installed?.addedDate || new Date().toISOString(),
        isFavorite: installed?.isFavorite,
        isHidden: installed?.isHidden,
        collections: installed?.collections,
        customCoverUrl: installed?.customCoverUrl,
        coverUrl: installed?.coverUrl,
        lastPlayed: installed?.lastPlayed
    }
}

export function gamesFromGogLibrary(owned: GogGalaxyOwnedGame[], installed: Game[]): Game[] {
    const installedByProduct = new Map<string, Game>()
    for (const g of installed) {
        const pid = g.gogProductId || g.id.replace(/^gog_/, '')
        if (pid) installedByProduct.set(pid, g)
    }

    const games: Game[] = []
    for (const entry of owned) {
        const inst = installedByProduct.get(entry.productId)
        games.push(gogEntryToGame(entry, inst))
    }
    return games
}

export function mergeGogLibraryWithInstalled(cloudGames: Game[], localGogGames: Game[]): Game[] {
    const cloudById = new Map(cloudGames.map(g => [g.id, g]))
    return mergeLibraryWithInstalled(cloudGames, localGogGames).map(game => {
        if (game.platform !== 'gog') return game
        const cloud = cloudById.get(game.id)
        const releaseKey = game.gogReleaseKey || cloud?.gogReleaseKey
        if (!releaseKey) return game
        return {
            ...game,
            gogReleaseKey: releaseKey,
            launchCommand: buildGogGalaxyUri({
                gogReleaseKey: releaseKey,
                gogProductId: game.gogProductId || cloud?.gogProductId
            })
        }
    })
}

export function parseGogError(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error)
    if (/GOG Galaxy not found|library not found/i.test(raw)) {
        return 'GOG Galaxy not detected. Install it, sign in, open Galaxy once, then sync again.'
    }
    if (raw.includes('Error invoking remote method')) {
        const match = raw.match(/Error: ([^\n]+)/)
        if (match?.[1]) return match[1]
    }
    return raw
}

export async function fetchGogLibraryFromGalaxy(customDbPath?: string): Promise<Game[]> {
    if (!window.electronAPI?.gogFetchLibrary) {
        throw new Error('GOG library sync is only available in the desktop app.')
    }

    const status = await window.electronAPI.gogStatus(customDbPath)
    if (!status.available) {
        throw new Error(status.error || 'GOG Galaxy library database not found.')
    }
    if (status.error && !status.gamesAvailable) {
        throw new Error(status.error)
    }

    const owned = await window.electronAPI.gogFetchLibrary(customDbPath)
    const { detectGOGGames } = await import('./platforms/gog')
    const installed = await detectGOGGames()
    return gamesFromGogLibrary(owned, installed)
}
