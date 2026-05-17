import { Settings } from '../types/game'

export function shouldApplyTdp(settings: Settings): boolean {
    return settings.tdpEnabled === true
}

export async function applyTdpFromSettings(settings: Settings): Promise<{ success: boolean; error?: string }> {
    if (!shouldApplyTdp(settings) || !window.electronAPI?.tdpApply) {
        return { success: false, error: 'TDP control is disabled' }
    }

    return window.electronAPI.tdpApply({
        preset: settings.tdpPreset ?? 'balanced',
        customWatts: settings.tdpCustomWatts ?? 15,
        ryzenAdjPath: settings.ryzenAdjPath
    })
}
