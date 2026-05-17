// GamerPower API Service
// API Documentation: https://www.gamerpower.com/api-read

import { FreeGame, GiveawayPlatform, GiveawayType, GiveawayWorth } from '../types/freeGame'

const BASE_URL = 'https://www.gamerpower.com/api'

interface FetchOptions {
    platform?: GiveawayPlatform
    type?: GiveawayType
    sortBy?: 'date' | 'value' | 'popularity'
}

/**
 * Helper function to fetch using Electron's CORS-bypassing httpFetch
 */
async function electronFetch(url: string): Promise<any> {
    const result = await window.electronAPI.httpFetch(url)

    // Handle 404 (No results found) gracefully by returning specific indicator
    if (result.status === 404) {
        return [] // Empty array indicates no results found
    }

    if (!result.ok) {
        throw new Error(`API error: ${result.status} - ${result.error || 'Unknown error'}`)
    }

    if (!result.data) {
        return null
    }

    return JSON.parse(result.data)
}

/**
 * Fetch all active giveaways with optional filters
 */
export async function fetchFreeGames(options: FetchOptions = {}): Promise<FreeGame[]> {
    try {
        const params = new URLSearchParams()

        if (options.platform) {
            params.append('platform', options.platform)
        }
        if (options.type) {
            params.append('type', options.type.toLowerCase())
        }
        if (options.sortBy) {
            params.append('sort-by', options.sortBy)
        }

        const url = `${BASE_URL}/giveaways${params.toString() ? '?' + params.toString() : ''}`
        console.log('Fetching free games from:', url)

        const data = await electronFetch(url)

        // API returns an object with message when no results OR we return [] from 404
        if (!data || data.status === 0 || !Array.isArray(data)) {
            return []
        }

        return data as FreeGame[]
    } catch (error) {
        console.error('Error fetching free games:', error)
        throw error
    }
}

/**
 * Fetch a single giveaway by ID
 */
export async function fetchGiveawayById(id: number): Promise<FreeGame | null> {
    try {
        return await electronFetch(`${BASE_URL}/giveaway?id=${id}`)
    } catch (error) {
        console.error('Error fetching giveaway:', error)
        return null
    }
}

/**
 * Get total worth estimation of all active giveaways
 */
export async function fetchGiveawayWorth(): Promise<GiveawayWorth | null> {
    try {
        return await electronFetch(`${BASE_URL}/worth`)
    } catch (error) {
        console.error('Error fetching giveaway worth:', error)
        return null
    }
}

/**
 * Parse the platforms string into an array
 */
export function parsePlatforms(platformsStr: string): string[] {
    if (!platformsStr) return []
    return platformsStr.split(',').map(p => p.trim())
}

/**
 * Get days remaining until giveaway ends
 */
export function getDaysRemaining(endDate: string | null): number | null {
    if (!endDate || endDate === 'N/A') return null

    const end = new Date(endDate)
    const now = new Date()
    const diffTime = end.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    return diffDays > 0 ? diffDays : 0
}

/**
 * Check if giveaway is expiring soon (within 3 days)
 */
export function isExpiringSoon(endDate: string | null): boolean {
    const days = getDaysRemaining(endDate)
    return days !== null && days <= 3 && days >= 0
}

/**
 * Format worth string (remove $ sign variations)
 */
export function formatWorth(worth: string): string {
    if (!worth || worth === 'N/A') return 'Free'
    return worth.startsWith('$') ? worth : `$${worth}`
}
