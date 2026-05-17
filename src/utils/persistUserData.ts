import type { UserData } from '../types/game'

const SAVE_DEBOUNCE_MS = 2500
let timer: ReturnType<typeof setTimeout> | null = null
let pending: UserData | null = null
let skipNextSave = true

/** Call once after the initial library load finishes so we do not rewrite disk immediately. */
export function markUserDataHydrated(): void {
    skipNextSave = false
}

export function scheduleSaveUserData(data: UserData): void {
    if (skipNextSave || data.games.length === 0) return
    pending = data
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
        timer = null
        const payload = pending
        pending = null
        if (payload && window.electronAPI?.saveUserData) {
            void window.electronAPI.saveUserData(payload)
        }
    }, SAVE_DEBOUNCE_MS)
}

export function flushSaveUserData(): void {
    if (timer) {
        clearTimeout(timer)
        timer = null
    }
    const payload = pending
    pending = null
    if (payload && window.electronAPI?.saveUserData) {
        void window.electronAPI.saveUserData(payload)
    }
}
