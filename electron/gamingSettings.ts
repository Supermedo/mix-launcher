import { app, BrowserWindow, globalShortcut, powerSaveBlocker } from 'electron'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

export type CloseButtonAction = 'ask' | 'tray' | 'quit'
export type WindowsPowerPlan = 'leave' | 'high' | 'balanced'

export interface GamingSettings {
    preventDisplaySleep?: boolean
    preventSleepWhilePlaying?: boolean
    alwaysOnTop?: boolean
    rememberWindowBounds?: boolean
    closeButtonAction?: CloseButtonAction
    globalHotkeyEnabled?: boolean
    windowsPowerPlan?: WindowsPowerPlan
    restorePowerPlanOnExit?: boolean
}

const DEFAULT_GAMING: GamingSettings = {
    preventDisplaySleep: true,
    preventSleepWhilePlaying: true,
    alwaysOnTop: false,
    rememberWindowBounds: true,
    closeButtonAction: 'ask',
    globalHotkeyEnabled: true,
    windowsPowerPlan: 'leave',
    restorePowerPlanOnExit: true
}

const HIGH_PERFORMANCE_GUID = '8c5e7fda-e8bf-4a96-9a85-ce6e23d256b0'
const BALANCED_GUID = '381b4222-f694-41f0-9685-ff647bb25822'

let current: GamingSettings = { ...DEFAULT_GAMING }
let displaySleepBlockerId: number | null = null
let playingDisplayBlockerId: number | null = null
let playingSuspendBlockerId: number | null = null
let savedPowerPlanGuid: string | null = null
let hotkeyRegistered = false
let getMainWindow: () => BrowserWindow | null = () => null

export function initGamingSettings(getWindow: () => BrowserWindow | null) {
    getMainWindow = getWindow
}

export function getGamingSettings(): GamingSettings {
    return { ...current }
}

function stopBlocker(id: number | null) {
    if (id !== null && powerSaveBlocker.isStarted(id)) {
        powerSaveBlocker.stop(id)
    }
}

function stopDisplaySleepBlocker() {
    stopBlocker(displaySleepBlockerId)
    displaySleepBlockerId = null
}

function startDisplaySleepBlocker() {
    stopDisplaySleepBlocker()
    if (current.preventDisplaySleep) {
        displaySleepBlockerId = powerSaveBlocker.start('prevent-display-sleep')
    }
}

export function stopPlayingSleepBlockers() {
    stopBlocker(playingDisplayBlockerId)
    stopBlocker(playingSuspendBlockerId)
    playingDisplayBlockerId = null
    playingSuspendBlockerId = null
}

export function startPlayingSleepBlockers() {
    stopPlayingSleepBlockers()
    if (!current.preventSleepWhilePlaying) return
    playingDisplayBlockerId = powerSaveBlocker.start('prevent-display-sleep')
    playingSuspendBlockerId = powerSaveBlocker.start('prevent-app-suspension')
}

function getActivePowerPlanGuid(): string | null {
    if (process.platform !== 'win32') return null
    try {
        const out = execSync('powercfg /getactivescheme', { encoding: 'utf-8' })
        const match = out.match(/([0-9a-f-]{36})/i)
        return match ? match[1] : null
    } catch {
        return null
    }
}

function setActivePowerPlan(guid: string): boolean {
    if (process.platform !== 'win32') return false
    try {
        execSync(`powercfg /setactive ${guid}`, { encoding: 'utf-8' })
        return true
    } catch {
        return false
    }
}

function applyWindowsPowerPlan() {
    if (process.platform !== 'win32' || current.windowsPowerPlan === 'leave') {
        return
    }

    if (!savedPowerPlanGuid) {
        savedPowerPlanGuid = getActivePowerPlanGuid()
    }

    if (current.windowsPowerPlan === 'high') {
        setActivePowerPlan(HIGH_PERFORMANCE_GUID)
    } else if (current.windowsPowerPlan === 'balanced') {
        setActivePowerPlan(BALANCED_GUID)
    }
}

export function restoreWindowsPowerPlan() {
    if (savedPowerPlanGuid && current.restorePowerPlanOnExit !== false) {
        setActivePowerPlan(savedPowerPlanGuid)
    }
    savedPowerPlanGuid = null
}

function unregisterHotkey() {
    if (hotkeyRegistered) {
        globalShortcut.unregister('CommandOrControl+Shift+G')
        hotkeyRegistered = false
    }
}

function registerHotkey() {
    unregisterHotkey()
    if (!current.globalHotkeyEnabled) return

    try {
        hotkeyRegistered = globalShortcut.register('CommandOrControl+Shift+G', () => {
            const win = getMainWindow()
            if (!win) return
            if (win.isVisible()) {
                win.hide()
            } else {
                win.show()
                win.focus()
            }
        })
    } catch (e) {
        console.error('Global hotkey registration failed:', e)
        hotkeyRegistered = false
    }
}

function applyWindowFlags() {
    const win = getMainWindow()
    if (!win || win.isDestroyed()) return
    win.setAlwaysOnTop(!!current.alwaysOnTop, 'screen-saver')
}

function boundsFilePath() {
    return path.join(app.getPath('userData'), 'window-bounds.json')
}

export function saveWindowBounds() {
    if (!current.rememberWindowBounds) return
    const win = getMainWindow()
    if (!win || win.isDestroyed()) return
    try {
        const bounds = win.getBounds()
        const isMaximized = win.isMaximized()
        fs.writeFileSync(boundsFilePath(), JSON.stringify({ bounds, isMaximized }, null, 2))
    } catch {
        /* ignore */
    }
}

export function restoreWindowBounds() {
    if (!current.rememberWindowBounds) return
    const win = getMainWindow()
    if (!win || win.isDestroyed()) return
    try {
        if (!fs.existsSync(boundsFilePath())) return
        const data = JSON.parse(fs.readFileSync(boundsFilePath(), 'utf-8'))
        if (data.bounds) {
            win.setBounds(data.bounds)
        }
        if (data.isMaximized) {
            win.maximize()
        }
    } catch {
        /* ignore */
    }
}

export function applyGamingSettings(partial: GamingSettings) {
    current = { ...DEFAULT_GAMING, ...current, ...partial }

    startDisplaySleepBlocker()
    applyWindowFlags()
    registerHotkey()
    applyWindowsPowerPlan()
}

export function getCloseButtonAction(): CloseButtonAction {
    return current.closeButtonAction ?? 'ask'
}

export function cleanupGamingSettings() {
    stopDisplaySleepBlocker()
    stopPlayingSleepBlockers()
    unregisterHotkey()
    restoreWindowsPowerPlan()
}
