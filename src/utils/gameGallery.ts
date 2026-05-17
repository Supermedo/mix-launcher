import { Game } from '../types/game'

/** Build a deduped gallery list (screenshots first, then hero / cover fallbacks). */
export function getGameGalleryImages(game: Game | null | undefined, max = 8): string[] {
    if (!game) return []

    const urls: string[] = []
    const seen = new Set<string>()

    const add = (url?: string | null) => {
        if (!url || seen.has(url)) return
        seen.add(url)
        urls.push(url)
    }

    game.screenshots?.forEach(add)
    add(game.backgroundUrl)
    add(game.customCoverUrl)
    add(game.coverUrl)

    return urls.slice(0, max)
}
