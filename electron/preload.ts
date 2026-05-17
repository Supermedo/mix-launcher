import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    toggleFullscreen: (flag?: boolean) => ipcRenderer.send('window:toggleFullscreen', flag),
    hideToTray: () => ipcRenderer.send('window:hideToTray'),
    setZoomFactor: (factor: number) => ipcRenderer.invoke('window:setZoom', factor),

    // File system
    readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
    readDir: (path: string) => ipcRenderer.invoke('fs:readDir', path),
    exists: (path: string) => ipcRenderer.invoke('fs:exists', path),
    readBinary: (path: string) => ipcRenderer.invoke('fs:readBinary', path),

    // Registry
    readRegistry: (keyPath: string, valueName: string) =>
        ipcRenderer.invoke('registry:read', keyPath, valueName),
    readAllRegistryValues: (keyPath: string) =>
        ipcRenderer.invoke('registry:readAllValues', keyPath),

    // Game launch
    launchGame: (command: string, args?: string[]) =>
        ipcRenderer.invoke('game:launch', command, args),
    openCloudFullscreen: (url: string, title?: string) =>
        ipcRenderer.invoke('cloud:openFullscreen', url, title),

    // App paths
    getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),

    // Environment
    getEnv: (name: string) => ipcRenderer.invoke('env:get', name),

    // Dialogs
    openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
    showMessage: (payload: { message: string; title?: string; type?: 'info' | 'warning' | 'error' }) =>
        ipcRenderer.invoke('dialog:showMessage', payload),

    // User data
    loadUserData: () => ipcRenderer.invoke('userData:load'),
    saveUserData: (data: any) => ipcRenderer.invoke('userData:save', data),

    // HTTP fetch (bypasses CORS)
    httpFetch: (url: string, options?: { method?: string, headers?: Record<string, string>, body?: string }) =>
        ipcRenderer.invoke('http:fetch', url, options),

    // External URLs
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

    // Steam Authentication
    steamLogin: () => ipcRenderer.invoke('steam:login'),
    steamCancelLogin: () => ipcRenderer.invoke('steam:cancelLogin'),
    steamGetSession: () => ipcRenderer.invoke('steam:getSession'),

    legendaryStatus: (customPath?: string) => ipcRenderer.invoke('legendary:status', customPath),
    legendaryFetchLibrary: (customPath?: string) => ipcRenderer.invoke('legendary:fetchLibrary', customPath),
    legendaryAuth: (payload?: { mode?: 'interactive' | 'import'; customPath?: string }) =>
        ipcRenderer.invoke('legendary:auth', payload),
    legendaryLogout: (customPath?: string) => ipcRenderer.invoke('legendary:logout', customPath),
    legendaryBrowse: () => ipcRenderer.invoke('legendary:browse'),
    legendaryLaunch: (appName: string, customPath?: string) =>
        ipcRenderer.invoke('legendary:launch', appName, customPath),
    legendaryInstall: (appName: string, customPath?: string) =>
        ipcRenderer.invoke('legendary:install', appName, customPath),
    legendaryDownload: () => ipcRenderer.invoke('legendary:download'),

    gogStatus: (customDbPath?: string) => ipcRenderer.invoke('gog:status', customDbPath),
    gogFetchLibrary: (customDbPath?: string) => ipcRenderer.invoke('gog:fetchLibrary', customDbPath),
    gogBrowse: () => ipcRenderer.invoke('gog:browse'),
    gogOpenInGalaxy: (payload: { uri?: string; releaseKey?: string; productId?: string }) =>
        ipcRenderer.invoke('gog:openInGalaxy', payload),
    epicOpenInLauncher: (payload: {
        appName: string
        namespace?: string
        catalogItemId?: string
        install?: boolean
        legendaryPath?: string
    }) => ipcRenderer.invoke('epic:openInLauncher', payload),

    // Auto-start
    autoStartSet: (enable: boolean) => ipcRenderer.invoke('autoStart:set', enable),
    autoStartGet: () => ipcRenderer.invoke('autoStart:get'),

    getPowerState: () => ipcRenderer.invoke('power:getState'),
    xboxListInstalled: () => ipcRenderer.invoke('xbox:listInstalled'),
    tdpDetect: (customPath?: string) => ipcRenderer.invoke('tdp:detect', customPath),
    tdpApply: (payload: {
        preset: 'eco' | 'balanced' | 'performance' | 'turbo' | 'custom'
        customWatts?: number
        ryzenAdjPath?: string
    }) => ipcRenderer.invoke('tdp:apply', payload),
    tdpBrowseRyzenAdj: () => ipcRenderer.invoke('tdp:browseRyzenAdj'),
    applyGamingSettings: (settings: {
        preventDisplaySleep?: boolean
        preventSleepWhilePlaying?: boolean
        alwaysOnTop?: boolean
        rememberWindowBounds?: boolean
        closeButtonAction?: 'ask' | 'tray' | 'quit'
        globalHotkeyEnabled?: boolean
        windowsPowerPlan?: 'leave' | 'high' | 'balanced'
        restorePowerPlanOnExit?: boolean
    }) => ipcRenderer.invoke('gaming:applySettings', settings),
    onPowerState: (callback: (state: { onBattery: boolean; charging: boolean; level: number | null }) => void) => {
        const listener = (_event: unknown, state: { onBattery: boolean; charging: boolean; level: number | null }) =>
            callback(state)
        ipcRenderer.on('power:state', listener)
        return () => ipcRenderer.removeListener('power:state', listener)
    }
})

