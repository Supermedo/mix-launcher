import { HandheldDefaultFilter, Settings } from '../types/game'
import { gamepadManager } from '../services/gamepadManager'

/** Typical Windows handheld panel sizes (ROG Ally, Legion Go, GPD Win, etc.). */
export function isSmallHandheldScreen(): boolean {
    const w = window.screen.width
    const h = window.screen.height
    const shortSide = Math.min(w, h)
    const longSide = Math.max(w, h)
    return shortSide <= 900 || (longSide <= 1366 && shortSide <= 1024)
}

export function hasConnectedGamepad(): boolean {
    gamepadManager.start()
    if (gamepadManager.getDevices().length === 0) {
        gamepadManager.refreshDevices()
    }
    return gamepadManager.hasAnyConnected()
}

export function shouldUseHandheldMode(settings: Settings): boolean {
    if (settings.handheldMode) return true
    if (settings.handheldAutoDetect === false) return false
    return isSmallHandheldScreen() || hasConnectedGamepad()
}

export function resolveHandheldDefaultFilter(settings: Settings): HandheldDefaultFilter {
    return settings.handheldDefaultFilter ?? 'all'
}

export function uiScaleToZoom(scale: Settings['uiScale']): number {
    switch (scale) {
        case '150': return 1.5
        case '125': return 1.25
        case '115': return 1.15
        default: return 1
    }
}
