export interface ElectronAPI {
    minimize: () => void
    maximize: () => void
    close: () => void
    toggleFullscreen: (flag?: boolean) => void
    hideToTray: () => void
    setZoomFactor: (factor: number) => Promise<boolean>
    readFile: (path: string) => Promise<string | null>
    readDir: (path: string) => Promise<string[]>
    exists: (path: string) => Promise<boolean>
    readBinary: (path: string) => Promise<Buffer | null>
    readRegistry: (keyPath: string, valueName: string) => Promise<string | null>
    readAllRegistryValues: (keyPath: string) => Promise<string | null>
    launchGame: (command: string, args?: string[]) => Promise<boolean>
    openCloudFullscreen: (url: string, title?: string) => Promise<boolean>
    getPath: (name: string) => Promise<string>
    getEnv: (name: string) => Promise<string | null>
    openFileDialog: () => Promise<string | null>
    showMessage: (payload: {
        message: string
        title?: string
        type?: 'info' | 'warning' | 'error'
    }) => Promise<void>
    loadUserData: () => Promise<any>
    saveUserData: (data: any) => Promise<boolean>
    httpFetch: (url: string, options?: { method?: string, headers?: Record<string, string>, body?: string }) =>
        Promise<{ ok: boolean, status: number, data: string | null, error?: string }>
    // External URLs
    openExternal: (url: string) => Promise<void>
    // Steam Authentication
    steamLogin: () => Promise<{ success: boolean, steamId?: string, error?: string }>
    steamCancelLogin: () => Promise<boolean>
    steamGetSession: () => Promise<string | null>
    legendaryStatus: (customPath?: string) => Promise<LegendaryStatusResult>
    legendaryFetchLibrary: (customPath?: string) => Promise<LegendaryLibraryResult>
    legendaryAuth: (payload?: { mode?: 'interactive' | 'import'; customPath?: string }) => Promise<{
        ok: boolean
        error?: string
        executable?: string
    }>
    legendaryLogout: (customPath?: string) => Promise<{ ok: boolean; error?: string }>
    legendaryBrowse: () => Promise<string | null>
    legendaryLaunch: (appName: string, customPath?: string) => Promise<boolean>
    legendaryInstall: (appName: string, customPath?: string) => Promise<boolean>
    legendaryDownload: () => Promise<{ ok: boolean; executable?: string; error?: string }>
    gogStatus: (customDbPath?: string) => Promise<GogGalaxyStatusResult>
    gogFetchLibrary: (customDbPath?: string) => Promise<GogGalaxyOwnedGame[]>
    gogBrowse: () => Promise<string | null>
    gogOpenInGalaxy: (payload: { uri?: string; releaseKey?: string; productId?: string }) => Promise<boolean>
    epicOpenInLauncher: (payload: {
        appName: string
        namespace?: string
        catalogItemId?: string
        install?: boolean
        legendaryPath?: string
    }) => Promise<boolean>
    // Auto-start
    autoStartSet: (enable: boolean) => Promise<boolean>
    autoStartGet: () => Promise<boolean>
    getPowerState: () => Promise<PowerState>
    applyGamingSettings: (settings: GamingSettingsPayload) => Promise<boolean>
    xboxListInstalled: () => Promise<Array<{ id: string; name: string; launchCommand: string; installPath?: string }>>
    tdpDetect: (customPath?: string) => Promise<TdpDetectResult>
    tdpApply: (payload: TdpApplyPayload) => Promise<TdpApplyResult>
    tdpBrowseRyzenAdj: () => Promise<string | null>
    onPowerState: (callback: (state: PowerState) => void) => () => void
}

export interface TdpDetectResult {
    supported: boolean
    ryzenAdjFound: boolean
    ryzenAdjPath: string | null
    isAdmin: boolean
    message: string
}

export interface TdpApplyPayload {
    preset: 'eco' | 'balanced' | 'performance' | 'turbo' | 'custom'
    customWatts?: number
    ryzenAdjPath?: string
}

export interface TdpApplyResult {
    success: boolean
    watts?: number
    error?: string
    elevated?: boolean
}

export interface GamingSettingsPayload {
    preventDisplaySleep?: boolean
    preventSleepWhilePlaying?: boolean
    alwaysOnTop?: boolean
    rememberWindowBounds?: boolean
    closeButtonAction?: 'ask' | 'tray' | 'quit'
    globalHotkeyEnabled?: boolean
    windowsPowerPlan?: 'leave' | 'high' | 'balanced'
    restorePowerPlanOnExit?: boolean
}

export interface PowerState {
    onBattery: boolean
    charging: boolean
    level: number | null
}

export interface LegendaryStatusResult {
    available: boolean
    executable: string | null
    authenticated: boolean
    account?: string
    gamesAvailable?: number
    gamesInstalled?: number
    bundled?: boolean
    downloaded?: boolean
    error?: string
}

export interface GogGalaxyStatusResult {
    available: boolean
    databasePath: string | null
    gamesAvailable?: number
    error?: string
}

export interface GogGalaxyOwnedGame {
    releaseKey: string
    productId: string
    title: string
}

export interface LegendaryLibraryResult {
    games: Array<{
        app_name: string
        app_title?: string
        catalog_item_id?: string
        catalog_namespace?: string
    }>
    installed: Array<{
        app_name: string
        install_path?: string
        version?: string
    }>
}

declare global {
    interface Window {
        electronAPI: ElectronAPI
    }
}

