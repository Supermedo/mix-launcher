import { Game } from '../types/game'

// SteamGridDB API for game artwork
const STEAMGRIDDB_API_KEY = '7c9f48f2b0e71060d687ae073eb5ff27'
const STEAMGRIDDB_BASE_URL = 'https://www.steamgriddb.com/api/v2'

// RAWG.io API for game metadata (free, no auth required)
const RAWG_API_KEY = 'c542e67aec3a4340908f9de9e86038af'
const RAWG_BASE_URL = 'https://api.rawg.io/api'

interface SteamGridDBSearchResult {
    success: boolean
    data: {
        id: number
        name: string
        types: string[]
    }[]
}

interface SteamGridDBGridResult {
    success: boolean
    data: {
        id: number
        url: string
        thumb: string
        style: string
    }[]
}

interface RAWGGame {
    id: number
    name: string
    background_image: string
    description_raw?: string
    released?: string
    rating?: number
    genres?: { name: string }[]
    developers?: { name: string }[]
    publishers?: { name: string }[]
    short_screenshots?: { image: string }[]
}

// Cache for scraped metadata
const metadataCache: Map<string, any> = new Map()

// Clear the metadata cache (for force refresh)
export function clearMetadataCache(): void {
    metadataCache.clear()
    console.log('Metadata cache cleared')
}

// Helper to make HTTP requests via Electron (bypasses CORS)
async function electronFetch(url: string, headers?: Record<string, string>): Promise<{ ok: boolean, data: any }> {
    if (!window.electronAPI?.httpFetch) {
        // Fallback to regular fetch if not in Electron
        try {
            const response = await fetch(url, { headers })
            const data = await response.json()
            return { ok: response.ok, data }
        } catch {
            return { ok: false, data: null }
        }
    }

    const response = await window.electronAPI.httpFetch(url, { headers })
    if (response.ok && response.data) {
        try {
            return { ok: true, data: JSON.parse(response.data) }
        } catch {
            return { ok: false, data: null }
        }
    }
    return { ok: false, data: null }
}

// Get SteamGridDB game ID from Steam App ID (direct lookup, more reliable)
async function getSteamGridDBBySteamAppId(steamAppId: string): Promise<number | null> {
    try {
        console.log(`SteamGridDB: Looking up Steam App ID ${steamAppId}`)

        const response = await electronFetch(
            `${STEAMGRIDDB_BASE_URL}/games/steam/${steamAppId}`,
            { 'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}` }
        )

        if (response.ok && response.data && response.data.success && response.data.data) {
            console.log(`SteamGridDB: Found game ID ${response.data.data.id} for Steam App ${steamAppId}`)
            return response.data.data.id
        }

        return null
    } catch (error) {
        console.error('SteamGridDB Steam lookup error:', error)
        return null
    }
}

// Search SteamGridDB for a game by name (fallback)
async function searchSteamGridDB(gameName: string): Promise<number | null> {
    try {
        const cleanName = gameName
            .replace(/™|®|©/g, '')
            .replace(/\s+/g, ' ')
            .trim()

        console.log(`SteamGridDB: Searching for "${cleanName}"`)

        const response = await electronFetch(
            `${STEAMGRIDDB_BASE_URL}/search/autocomplete/${encodeURIComponent(cleanName)}`,
            { 'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}` }
        )

        if (response.ok && response.data) {
            const data = response.data as SteamGridDBSearchResult
            if (data.success && data.data && data.data.length > 0) {
                console.log(`SteamGridDB: Found game ID ${data.data[0].id} for "${cleanName}"`)
                return data.data[0].id
            }
        }

        return null
    } catch (error) {
        console.error('SteamGridDB search error:', error)
        return null
    }
}

// Get grid/cover image from SteamGridDB - prioritize official/official-quality covers
async function getSteamGridDBCover(gameId: number): Promise<string | null> {
    try {
        // First try to get official or high-quality alternate covers at 600x900 (standard vertical cover)
        const styles = ['official', 'white_logo', 'material', 'alternate', 'blurred', 'no_logo']

        for (const style of styles) {
            const response = await electronFetch(
                `${STEAMGRIDDB_BASE_URL}/grids/game/${gameId}?dimensions=600x900&styles=${style}&nsfw=false`,
                { 'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}` }
            )

            if (response.ok && response.data) {
                const data = response.data as SteamGridDBGridResult
                if (data.success && data.data && data.data.length > 0) {
                    console.log(`SteamGridDB: Found ${style} cover for game ${gameId}`)
                    return data.data[0].url
                }
            }
        }

        // Fallback: get any grid at any dimension
        const fallbackResponse = await electronFetch(
            `${STEAMGRIDDB_BASE_URL}/grids/game/${gameId}?nsfw=false`,
            { 'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}` }
        )

        if (fallbackResponse.ok && fallbackResponse.data) {
            const data = fallbackResponse.data as SteamGridDBGridResult
            if (data.success && data.data && data.data.length > 0) {
                return data.data[0].url
            }
        }

        return null
    } catch (error) {
        console.error('SteamGridDB cover error:', error)
        return null
    }
}

// Get hero/background image from SteamGridDB
async function getSteamGridDBHero(gameId: number): Promise<string | null> {
    try {
        const response = await electronFetch(
            `${STEAMGRIDDB_BASE_URL}/heroes/game/${gameId}`,
            { 'Authorization': `Bearer ${STEAMGRIDDB_API_KEY}` }
        )

        if (response.ok && response.data) {
            const data = response.data as SteamGridDBGridResult
            if (data.success && data.data && data.data.length > 0) {
                return data.data[0].url
            }
        }

        return null
    } catch (error) {
        console.error('SteamGridDB hero error:', error)
        return null
    }
}

// Get RAWG game details by ID (includes full description)
async function getRAWGGameDetails(gameId: number): Promise<RAWGGame | null> {
    try {
        const response = await electronFetch(
            `${RAWG_BASE_URL}/games/${gameId}?key=${RAWG_API_KEY}`
        )

        if (response.ok && response.data) {
            return response.data
        }

        return null
    } catch (error) {
        console.error('RAWG details error:', error)
        return null
    }
}

async function fetchSteamStoreScreenshots(steamAppId: string): Promise<string[]> {
    try {
        const response = await electronFetch(
            `https://store.steampowered.com/api/appdetails?appids=${steamAppId}&cc=us&l=en`
        )
        const entry = response.data?.[steamAppId]
        if (!response.ok || !entry?.success || !entry.data?.screenshots) {
            return []
        }
        return entry.data.screenshots
            .map((s: { path_full?: string }) => s.path_full)
            .filter(Boolean) as string[]
    } catch {
        return []
    }
}

function mergeScreenshotUrls(...lists: (string[] | undefined)[]): string[] {
    const seen = new Set<string>()
    const merged: string[] = []
    for (const list of lists) {
        for (const url of list || []) {
            if (url && !seen.has(url)) {
                seen.add(url)
                merged.push(url)
            }
        }
    }
    return merged
}

// Search RAWG for additional metadata
async function searchRAWG(gameName: string): Promise<RAWGGame | null> {
    try {
        const cleanName = gameName
            .replace(/™|®|©/g, '')
            .replace(/\s+/g, ' ')
            .trim()

        const response = await electronFetch(
            `${RAWG_BASE_URL}/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(cleanName)}&page_size=1`
        )

        if (response.ok && response.data && response.data.results && response.data.results.length > 0) {
            const searchResult = response.data.results[0]
            // Fetch full game details to get description
            const fullDetails = await getRAWGGameDetails(searchResult.id)
            if (fullDetails) {
                return fullDetails
            }
            return searchResult
        }

        return null
    } catch (error) {
        console.error('RAWG search error:', error)
        return null
    }
}

export async function scrapeGameMetadata(game: Game): Promise<Partial<Game>> {
    // Check cache first
    if (metadataCache.has(game.name.toLowerCase())) {
        return metadataCache.get(game.name.toLowerCase())
    }

    console.log(`Scraping metadata for: ${game.name}`)

    const result: Partial<Game> = {}

    try {
        let steamGridId: number | null = null

        // For Steam games, try direct App ID lookup first (more reliable)
        if (game.platform === 'steam' && game.id.startsWith('steam_')) {
            const steamAppId = game.id.replace('steam_', '')
            steamGridId = await getSteamGridDBBySteamAppId(steamAppId)
        }

        // Fallback to name search
        if (!steamGridId) {
            steamGridId = await searchSteamGridDB(game.name)
        }

        if (steamGridId) {
            const [cover, hero] = await Promise.all([
                getSteamGridDBCover(steamGridId),
                getSteamGridDBHero(steamGridId)
            ])

            if (cover) {
                result.coverUrl = cover
                console.log(`Got SteamGridDB cover for ${game.name}`)
            }
            if (hero) {
                result.backgroundUrl = hero
            }
        }

        // Get additional metadata from RAWG
        const rawgGame = await searchRAWG(game.name)

        if (rawgGame) {
            // Only use RAWG background if we didn't get one from SteamGridDB
            if (!result.backgroundUrl && rawgGame.background_image) {
                result.backgroundUrl = rawgGame.background_image
            }
            // Use RAWG cover as fallback
            if (!result.coverUrl && rawgGame.background_image) {
                result.coverUrl = rawgGame.background_image
            }

            result.description = rawgGame.description_raw || ''
            result.releaseDate = rawgGame.released
            result.rating = rawgGame.rating
            result.genres = rawgGame.genres?.map(g => g.name) || []
            result.developer = rawgGame.developers?.[0]?.name
            result.publisher = rawgGame.publishers?.[0]?.name
            result.screenshots = rawgGame.short_screenshots?.map(s => s.image) || []
        }

        if (game.platform === 'steam' && game.id.startsWith('steam_')) {
            const steamAppId = game.id.replace('steam_', '')
            const steamShots = await fetchSteamStoreScreenshots(steamAppId)
            if (steamShots.length > 0) {
                result.screenshots = mergeScreenshotUrls(result.screenshots, steamShots)
            }
        }

        // Cache the result
        metadataCache.set(game.name.toLowerCase(), result)

    } catch (error) {
        console.error(`Error scraping metadata for ${game.name}:`, error)
    }

    return result
}

// Process games in parallel batches for faster scraping
export interface ScrapeMetadataOptions {
    shouldCancel?: () => boolean
    onBatchDone?: (batchGames: Game[], batchStart: number) => void
}

export async function scrapeAllGamesMetadata(
    games: Game[],
    onProgress?: (current: number, total: number, gameName: string) => void,
    options?: ScrapeMetadataOptions
): Promise<Game[]> {
    const enrichedGames: Game[] = games.map(g => ({ ...g }))
    const BATCH_SIZE = 2

    for (let batchStart = 0; batchStart < games.length; batchStart += BATCH_SIZE) {
        if (options?.shouldCancel?.()) break

        const batchEnd = Math.min(batchStart + BATCH_SIZE, games.length)
        const batch = games.slice(batchStart, batchEnd)

        if (onProgress) {
            const first = batch[0]?.name ?? ''
            onProgress(batchEnd, games.length, first)
        }

        const batchResults = await Promise.all(
            batch.map(async game => {
                if (options?.shouldCancel?.()) return game
                if (!game.coverUrl) {
                    const metadata = await scrapeGameMetadata(game)
                    return { ...game, ...metadata }
                }
                return game
            })
        )

        for (let i = 0; i < batchResults.length; i++) {
            enrichedGames[batchStart + i] = batchResults[i]
        }

        options?.onBatchDone?.(batchResults, batchStart)

        if (options?.shouldCancel?.()) break

        if (batchEnd < games.length) {
            await new Promise(resolve => setTimeout(resolve, 350))
        }
    }

    return enrichedGames
}

