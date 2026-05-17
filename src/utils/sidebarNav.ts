import { Collection, PLATFORMS, Platform } from '../types/game'

export type SidebarNavId =
    | Platform
    | 'all'
    | 'favorites'
    | 'installed'
    | 'hidden'
    | 'freegames'
    | 'cloudgaming'
    | string

/** Platforms shown under the Platforms group (cloud has its own sidebar entry). */
export const SIDEBAR_PLATFORM_IDS: Platform[] = (
    Object.keys(PLATFORMS) as Platform[]
).filter(p => p !== 'cloud' && p !== 'manual')

export function buildSidebarNavIds(collections: Collection[] = []): SidebarNavId[] {
    const ids: SidebarNavId[] = ['all', 'installed', 'favorites', 'freegames', 'cloudgaming', 'hidden']
    ids.push(...SIDEBAR_PLATFORM_IDS)
    for (const c of collections) {
        ids.push(c.id)
    }
    return ids
}
