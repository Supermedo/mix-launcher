import { Game, PLATFORMS, Platform } from '../types/game'
import { SIDEBAR_PLATFORM_IDS } from './sidebarNav'

export type FullscreenFilterId = 'all' | 'installed' | 'favorites' | 'recent' | Platform

export interface FullscreenNavItem {
    id: FullscreenFilterId
    label: string
    icon: string
}

const SHORT_PLATFORM_LABELS: Partial<Record<Platform, string>> = {
    steam: 'Steam',
    epic: 'Epic',
    ea: 'EA',
    ubisoft: 'Ubisoft',
    gog: 'GOG',
    amazon: 'Amazon',
    xbox: 'Xbox',
    cloud: 'Cloud',
    manual: 'My Games'
}

const LIBRARY_FILTER_IDS = new Set<FullscreenFilterId>(['all', 'installed', 'favorites', 'recent'])

export function isFullscreenLibraryFilter(id: FullscreenFilterId): boolean {
    return LIBRARY_FILTER_IDS.has(id)
}

function platformLabel(id: Platform): string {
    return SHORT_PLATFORM_LABELS[id] ?? PLATFORMS[id].name
}

const LIBRARY_NAV: FullscreenNavItem[] = [
    { id: 'all', label: 'All Games', icon: '' },
    { id: 'installed', label: 'Installed', icon: '' },
    { id: 'favorites', label: 'Favorites', icon: '' },
    { id: 'recent', label: 'Recent', icon: '' }
]

/** All Big Picture nav tabs — platforms always listed (even if library count is 0). */
export function buildFullscreenNavItems(): FullscreenNavItem[] {
    const platformNav: FullscreenNavItem[] = SIDEBAR_PLATFORM_IDS.map(id => ({
        id,
        label: platformLabel(id),
        icon: '' // use PlatformIcon in Big Picture bar
    }))

    const cloudNav: FullscreenNavItem = {
        id: 'cloud',
        label: platformLabel('cloud'),
        icon: ''
    }

    if (!platformNav.some(p => p.id === 'cloud')) {
        platformNav.push(cloudNav)
    }

    return [...LIBRARY_NAV, ...platformNav]
}

export function countGamesForFilter(games: Game[], filterId: FullscreenFilterId): number {
    const visible = games.filter(g => !g.isHidden)
    switch (filterId) {
        case 'installed':
            return visible.filter(g => g.isInstalled !== false).length
        case 'favorites':
            return visible.filter(g => g.isFavorite).length
        case 'recent':
            return visible.filter(g => g.lastPlayed).length
        case 'all':
            return visible.length
        default:
            return visible.filter(g => g.platform === filterId).length
    }
}
