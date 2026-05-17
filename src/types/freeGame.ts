// GamerPower API Types

export interface FreeGame {
    id: number
    title: string
    worth: string
    thumbnail: string
    image: string
    description: string
    instructions: string
    open_giveaway_url: string
    published_date: string
    type: GiveawayType
    platforms: string
    end_date: string | null
    users: number
    status: 'Active' | 'Expired'
    gamerpower_url: string
    open_giveaway: string
}

export type GiveawayType = 'Game' | 'DLC' | 'Early Access' | 'Loot' | 'Other'

export type GiveawayPlatform =
    | 'pc'
    | 'steam'
    | 'epic-games-store'
    | 'gog'
    | 'origin'
    | 'ubisoft'
    | 'itchio'
    | 'ps4'
    | 'ps5'
    | 'xbox-one'
    | 'xbox-series-xs'
    | 'switch'
    | 'android'
    | 'ios'

export interface FreeGamesFilter {
    platform: GiveawayPlatform | 'all'
    type: GiveawayType | 'all'
    sortBy: 'date' | 'value' | 'popularity'
}

export interface GiveawayWorth {
    active_giveaways_number: number
    worth_estimation_usd: string
}

export const GIVEAWAY_PLATFORMS: { id: GiveawayPlatform | 'all'; name: string; icon: string }[] = [
    { id: 'all', name: 'All', icon: '🎮' },
    { id: 'pc', name: 'PC', icon: '💻' },
    { id: 'steam', name: 'Steam', icon: '🎮' },
    { id: 'epic-games-store', name: 'Epic', icon: '🎯' },
    { id: 'gog', name: 'GOG', icon: '🌌' },
    { id: 'ubisoft', name: 'Ubisoft', icon: '🔷' },
    { id: 'origin', name: 'EA/Origin', icon: '⚡' },
    { id: 'itchio', name: 'Itch.io', icon: '🎨' },
    { id: 'android', name: 'Android', icon: '📱' },
    { id: 'ios', name: 'iOS', icon: '🍎' },
]

export const GIVEAWAY_TYPES: { id: GiveawayType | 'all'; name: string }[] = [
    { id: 'all', name: 'All Types' },
    { id: 'Game', name: 'Games' },
    { id: 'DLC', name: 'DLC' },
    { id: 'Loot', name: 'Loot' },
    { id: 'Early Access', name: 'Early Access' },
]
