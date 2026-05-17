import { Game, Platform } from '../types/game'

const STEAM_API_BASE = 'https://api.steampowered.com'
// Steam Web API key for fetching user libraries
const STEAM_API_KEY = '3400C89966BC7D289BFEA157328E522B'

interface SteamOwnedGame {
    appid: number
    name: string
    playtime_forever: number
    img_icon_url: string
    img_logo_url: string
}

interface SteamOwnedGamesResponse {
    response: {
        game_count: number
        games: SteamOwnedGame[]
    }
}

// Fetch all owned games from Steam Web API (uses embedded API key)
export async function fetchSteamLibrary(steamId: string): Promise<Game[]> {
    const games: Game[] = []

    try {
        console.log('Steam API: Fetching library for', steamId)

        const url = `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v0001/?key=${STEAM_API_KEY}&steamid=${steamId}&format=json&include_appinfo=true&include_played_free_games=true`

        const response = await window.electronAPI.httpFetch(url)

        if (!response.ok || !response.data) {
            console.error('Steam API: Failed to fetch library', response)
            return games
        }

        const data: SteamOwnedGamesResponse = JSON.parse(response.data)

        if (!data.response || !data.response.games) {
            console.error('Steam API: No games in response')
            return games
        }

        console.log(`Steam API: Found ${data.response.game_count} games`)

        for (const game of data.response.games) {
            games.push({
                id: `steam_${game.appid}`,
                name: game.name,
                platform: 'steam' as Platform,
                launchCommand: `steam://rungameid/${game.appid}`,
                addedDate: new Date().toISOString(),
                playtime: game.playtime_forever,
                // Don't set coverUrl here - let scraper fetch from SteamGridDB
                // Steam CDN library covers don't exist for many games
                backgroundUrl: `https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/header.jpg`,
                // Mark as not installed initially - will be matched with local detection
                isInstalled: false
            })
        }

        console.log(`Steam API: Processed ${games.length} games`)
    } catch (error) {
        console.error('Steam API: Error fetching library:', error)
    }

    return games
}

// Merge cloud library with local installations
export function mergeLibraryWithInstalled(cloudGames: Game[], installedGames: Game[]): Game[] {
    const installedMap = new Map(installedGames.map(g => [g.id, g]))
    const merged: Game[] = []

    for (const cloudGame of cloudGames) {
        const installed = installedMap.get(cloudGame.id)
        if (installed) {
            // Game is installed - use local data but keep cloud metadata
            merged.push({
                ...cloudGame,
                ...installed,
                isInstalled: true,
                playtime: cloudGame.playtime || installed.playtime
            })
            installedMap.delete(cloudGame.id)
        } else {
            // Game is not installed
            merged.push({
                ...cloudGame,
                isInstalled: false
            })
        }
    }

    // Add any installed games not in cloud library
    for (const installed of installedMap.values()) {
        merged.push({
            ...installed,
            isInstalled: true
        })
    }

    return merged
}

// Trigger Steam install for a game
export function installSteamGame(appId: string): void {
    const numericId = appId.replace('steam_', '')
    window.electronAPI.launchGame(`steam://install/${numericId}`)
}
