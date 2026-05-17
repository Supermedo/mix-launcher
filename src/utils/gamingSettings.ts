import { Settings } from '../types/game'

export interface GamingSettingsPayload {
    preventDisplaySleep?: boolean
    preventSleepWhilePlaying?: boolean
    alwaysOnTop?: boolean
    rememberWindowBounds?: boolean
    closeButtonAction?: Settings['closeButtonAction']
    globalHotkeyEnabled?: boolean
    windowsPowerPlan?: Settings['windowsPowerPlan']
    restorePowerPlanOnExit?: boolean
}

export function settingsToGamingPayload(settings: Settings): GamingSettingsPayload {
    return {
        preventDisplaySleep: settings.preventDisplaySleep,
        preventSleepWhilePlaying: settings.preventSleepWhilePlaying,
        alwaysOnTop: settings.alwaysOnTop,
        rememberWindowBounds: settings.rememberWindowBounds,
        closeButtonAction: settings.closeButtonAction,
        globalHotkeyEnabled: settings.globalHotkeyEnabled,
        windowsPowerPlan: settings.windowsPowerPlan,
        restorePowerPlanOnExit: settings.restorePowerPlanOnExit
    }
}

export async function applyGamingFromSettings(settings: Settings): Promise<void> {
    if (!window.electronAPI?.applyGamingSettings) return
    await window.electronAPI.applyGamingSettings(settingsToGamingPayload(settings))
}
