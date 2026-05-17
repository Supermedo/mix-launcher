import { app, BrowserWindow, ipcMain, shell, dialog, Tray, Menu, nativeImage, powerMonitor } from 'electron'
import path from 'path'
import fs from 'fs'
import { execSync, spawn } from 'child_process'
import {
    initGamingSettings,
    applyGamingSettings,
    getCloseButtonAction,
    saveWindowBounds,
    restoreWindowBounds,
    startPlayingSleepBlockers,
    stopPlayingSleepBlockers,
    cleanupGamingSettings,
    type GamingSettings
} from './gamingSettings'
import { detectTdpSupport, applyTdpFromPreset, type TdpPresetId } from './tdpControl'
import { listXboxInstalledGames } from './xboxGames'
import { launchGameCommand, launchLegendaryHidden } from './launchGame'
import {
    downloadLegendaryWindows,
    fetchLegendaryOwnedGames,
    getLegendaryStatus,
    legendaryLogout,
    resolveLegendaryExecutable,
    startLegendaryAuth
} from './legendary'
import { fetchGogGalaxyOwnedGames, getGogGalaxyStatus, openGogGameInGalaxy } from './gogGalaxy'
import { openEpicGameInLauncher } from './epicLauncher'
import { closeCloudBrowser, openCloudBrowserFullscreen } from './cloudBrowser'
import { APP_NAME } from './constants'

const isDev = !app.isPackaged

// Native alert() titles and taskbar grouping use this name (not package.json "name").
app.setName(APP_NAME)

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        icon: path.join(__dirname, isDev ? '../public/icon.png' : '../dist/icon.png')
    })

    if (isDev) {
        mainWindow.loadURL('http://localhost:5175')
        mainWindow.webContents.openDevTools()
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
    }

    mainWindow.on('close', async (event) => {
        if (isQuitting) return

        event.preventDefault()
        saveWindowBounds()

        const action = getCloseButtonAction()
        if (action === 'tray') {
            mainWindow?.hide()
            return
        }
        if (action === 'quit') {
            isQuitting = true
            app.quit()
            return
        }

        const choice = await dialog.showMessageBox(mainWindow!, {
            type: 'question',
            buttons: ['Minimize to Tray', 'Close App'],
            defaultId: 0,
            title: `Close ${APP_NAME}`,
            message: 'What would you like to do?',
            detail: 'You can minimize to the system tray or quit. Change default behavior in Settings → Windows gaming.'
        })

        if (choice.response === 0) {
            mainWindow?.hide()
        } else {
            isQuitting = true
            app.quit()
        }
    })

    mainWindow.on('show', () => {
        stopPlayingSleepBlockers()
    })

    mainWindow.once('ready-to-show', () => {
        restoreWindowBounds()
    })

    mainWindow.on('closed', () => {
        mainWindow = null
    })
}

function loadGamingSettingsFromDisk(): GamingSettings | null {
    try {
        const dataPath = path.join(app.getPath('userData'), 'user-data.json')
        if (!fs.existsSync(dataPath)) return null
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
        const s = data?.settings
        if (!s) return null
        return {
            preventDisplaySleep: s.preventDisplaySleep,
            preventSleepWhilePlaying: s.preventSleepWhilePlaying,
            alwaysOnTop: s.alwaysOnTop,
            rememberWindowBounds: s.rememberWindowBounds,
            closeButtonAction: s.closeButtonAction,
            globalHotkeyEnabled: s.globalHotkeyEnabled,
            windowsPowerPlan: s.windowsPowerPlan,
            restorePowerPlanOnExit: s.restorePowerPlanOnExit
        }
    } catch {
        return null
    }
}

function createTray() {
    // Create tray icon
    const iconPath = path.join(__dirname, isDev ? '../public/icon.png' : '../dist/icon.png')
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })

    tray = new Tray(icon)
    tray.setToolTip(APP_NAME)

    // Create context menu
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show',
            click: () => {
                mainWindow?.show()
            }
        },
        {
            label: 'Quit',
            click: () => {
                isQuitting = true
                app.quit()
            }
        }
    ])

    tray.setContextMenu(contextMenu)

    // Click tray icon to toggle window
    tray.on('click', () => {
        if (mainWindow?.isVisible()) {
            mainWindow.hide()
        } else {
            mainWindow?.show()
        }
    })
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
    app.quit()
} else {
    app.on('second-instance', () => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
        }
    })

    app.whenReady().then(() => {
        initGamingSettings(() => mainWindow)
        createWindow()
        createTray()
        startPowerMonitoring()
        const gaming = loadGamingSettingsFromDisk()
        if (gaming) applyGamingSettings(gaming)
    })
}

app.on('will-quit', () => {
    closeCloudBrowser()
    saveWindowBounds()
    cleanupGamingSettings()
})

app.on('window-all-closed', () => {
    // Don't quit if window is just hidden to tray
    if (process.platform !== 'darwin' && isQuitting) {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

ipcMain.handle(
    'dialog:showMessage',
    async (
        _,
        payload: { message: string; title?: string; type?: 'info' | 'warning' | 'error' }
    ) => {
        const opts = {
            type: (payload.type ?? 'warning') as 'info' | 'warning' | 'error',
            title: payload.title ?? APP_NAME,
            message: payload.message,
            buttons: ['OK'] as const,
            defaultId: 0
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
            await dialog.showMessageBox(mainWindow, opts)
        } else {
            await dialog.showMessageBox(opts)
        }
    }
)

// Window controls
ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize()
    } else {
        mainWindow?.maximize()
    }
})
ipcMain.on('window:close', () => {
    // Trigger the close event which will show the dialog
    mainWindow?.close()
})
ipcMain.on('window:toggleFullscreen', (_, flag?: boolean) => {
    if (mainWindow) {
        if (typeof flag === 'boolean') {
            mainWindow.setFullScreen(flag)
        } else {
            mainWindow.setFullScreen(!mainWindow.isFullScreen())
        }
    }
})

ipcMain.on('window:hideToTray', () => {
    minimizeLauncherWhilePlaying()
})

/** Minimize (not hide) so the app stays in the taskbar — hiding felt like the app quit. */
function minimizeLauncherWhilePlaying() {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) return
    mainWindow.minimize()
    mainWindow.flashFrame(true)
    try {
        tray?.displayBalloon({
            iconType: 'info',
            title: APP_NAME,
            content: 'Minimized to the taskbar while you play. Restore from the taskbar, tray icon, or Ctrl+Shift+G.'
        })
    } catch {
        /* Balloon may be unsupported on some Windows builds */
    }
}

ipcMain.handle('window:setZoom', async (_, factor: number) => {
    if (mainWindow && factor >= 0.75 && factor <= 2) {
        mainWindow.webContents.setZoomFactor(factor)
        return true
    }
    return false
})

function getWindowsBatteryLevel(): number | null {
    if (process.platform !== 'win32') return null
    try {
        const out = execSync(
            'powershell -NoProfile -Command "(Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty EstimatedChargeRemaining)"',
            { encoding: 'utf-8', timeout: 5000 }
        )
        const level = parseInt(out.trim(), 10)
        return Number.isFinite(level) ? Math.min(100, Math.max(0, level)) : null
    } catch {
        return null
    }
}

function readPowerState() {
    const onBattery = powerMonitor.isOnBatteryPower()
    const level = getWindowsBatteryLevel()
    return {
        onBattery,
        charging: !onBattery,
        level
    }
}

function broadcastPowerState() {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.send('power:state', readPowerState())
}

let powerPollTimer: ReturnType<typeof setInterval> | null = null

function startPowerMonitoring() {
    broadcastPowerState()
    powerMonitor.on('on-ac', broadcastPowerState)
    powerMonitor.on('on-battery', broadcastPowerState)
    if (!powerPollTimer) {
        powerPollTimer = setInterval(broadcastPowerState, 60_000)
    }
}

ipcMain.handle('power:getState', async () => readPowerState())

// File system operations
ipcMain.handle('fs:readFile', async (_, filePath: string) => {
    try {
        return fs.readFileSync(filePath, 'utf-8')
    } catch {
        return null
    }
})

ipcMain.handle('fs:readDir', async (_, dirPath: string) => {
    try {
        return fs.readdirSync(dirPath)
    } catch {
        return []
    }
})

ipcMain.handle('fs:exists', async (_, filePath: string) => {
    return fs.existsSync(filePath)
})

ipcMain.handle('fs:readBinary', async (_, filePath: string) => {
    try {
        return fs.readFileSync(filePath)
    } catch {
        return null
    }
})

// Registry access for Windows
ipcMain.handle('registry:read', async (_, keyPath: string, valueName: string) => {
    try {
        const result = execSync(
            `reg query "${keyPath}" /v "${valueName}"`,
            { encoding: 'utf-8' }
        )
        const match = result.match(/REG_SZ\s+(.+)/i)
        return match ? match[1].trim() : null
    } catch {
        return null
    }
})

ipcMain.handle('registry:readAllValues', async (_, keyPath: string) => {
    try {
        const result = execSync(
            `reg query "${keyPath}" /s`,
            { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
        )
        return result
    } catch {
        return null
    }
})

// (Removed uwp:listGames handler)

ipcMain.handle('gaming:applySettings', async (_, settings: GamingSettings) => {
    applyGamingSettings(settings)
    return true
})

ipcMain.handle('tdp:detect', async (_, customPath?: string) => detectTdpSupport(customPath))

ipcMain.handle(
    'tdp:apply',
    async (
        _,
        payload: { preset: TdpPresetId; customWatts?: number; ryzenAdjPath?: string }
    ) => applyTdpFromPreset(payload.preset, payload.customWatts ?? 15, payload.ryzenAdjPath)
)

ipcMain.handle('xbox:listInstalled', async () => listXboxInstalledGames())

ipcMain.handle('tdp:browseRyzenAdj', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openFile'],
        filters: [{ name: 'RyzenAdj', extensions: ['exe'] }, { name: 'All Files', extensions: ['*'] }]
    })
    return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('legendary:status', async (_, customPath?: string) =>
    getLegendaryStatus(customPath, { allowDownload: false })
)

ipcMain.handle('legendary:fetchLibrary', async (_, customPath?: string) =>
    fetchLegendaryOwnedGames(customPath, { allowDownload: true })
)

ipcMain.handle('gog:status', async (_, customDbPath?: string) => getGogGalaxyStatus(customDbPath))

ipcMain.handle('gog:fetchLibrary', async (_, customDbPath?: string) => {
    const games = await fetchGogGalaxyOwnedGames(customDbPath)
    return games.map(g => ({
        releaseKey: g.releaseKey,
        productId: g.productId,
        title: g.title
    }))
})

ipcMain.handle('gog:browse', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openFile'],
        filters: [{ name: 'GOG Galaxy database', extensions: ['db'] }, { name: 'All Files', extensions: ['*'] }]
    })
    return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle(
    'gog:openInGalaxy',
    async (_, payload: { uri?: string; releaseKey?: string; productId?: string }) =>
        openGogGameInGalaxy(payload)
)

ipcMain.handle(
    'epic:openInLauncher',
    async (
        _,
        payload: {
            appName: string
            namespace?: string
            catalogItemId?: string
            install?: boolean
            legendaryPath?: string
        }
    ) => {
        const ok = await openEpicGameInLauncher(payload)
        if (ok && !payload.install) {
            startPlayingSleepBlockers()
        }
        return ok
    }
)

ipcMain.handle('legendary:download', async () => {
    try {
        const executable = await downloadLegendaryWindows()
        return { ok: true, executable }
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
})

ipcMain.handle(
    'legendary:auth',
    async (_, payload?: { mode?: 'interactive' | 'import'; customPath?: string }) => {
        const resolved = await resolveLegendaryExecutable(payload?.customPath, { allowDownload: true })
        if (!resolved) {
            return { ok: false, error: 'Epic sync tool not available. Try “Download Epic sync tool” in Settings.' }
        }
        startLegendaryAuth(resolved.executable, payload?.mode === 'import' ? 'import' : 'interactive')
        return { ok: true, executable: resolved.executable }
    }
)

ipcMain.handle('legendary:logout', async (_, customPath?: string) => {
    const resolved = await resolveLegendaryExecutable(customPath)
    if (!resolved) return { ok: false, error: 'Epic sync tool not found' }
    try {
        await legendaryLogout(resolved.executable)
        return { ok: true }
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
})

ipcMain.handle('legendary:browse', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openFile'],
        filters: [
            { name: 'Legendary', extensions: ['exe'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    })
    return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('legendary:launch', async (_, appName: string, customPath?: string) => {
    const resolved = await resolveLegendaryExecutable(customPath, { allowDownload: true })
    if (!resolved || !appName?.trim()) return false
    try {
        launchLegendaryHidden(resolved.executable, ['launch', appName.trim(), '-y'])
        startPlayingSleepBlockers()
        return true
    } catch {
        return false
    }
})

ipcMain.handle('legendary:install', async (_, appName: string, customPath?: string) => {
    const resolved = await resolveLegendaryExecutable(customPath, { allowDownload: true })
    if (!resolved || !appName?.trim()) return false
    try {
        launchLegendaryHidden(resolved.executable, ['install', appName.trim(), '-y'])
        return true
    } catch {
        return false
    }
})

// Launch game / cloud shortcut / store app
ipcMain.handle('game:launch', async (_, launchCommand: string, args?: string[]) => {
    const ok = await launchGameCommand(launchCommand, args)
    if (ok) {
        startPlayingSleepBlockers()
    }
    return ok
})

ipcMain.handle('cloud:openFullscreen', async (_, url: string, title?: string) => {
    const ok = openCloudBrowserFullscreen(url, title, () => stopPlayingSleepBlockers())
    if (ok) {
        startPlayingSleepBlockers()
    }
    return ok
})

// Get app data path
ipcMain.handle('app:getPath', async (_, name: string) => {
    return app.getPath(name as any)
})

// Get environment variable
ipcMain.handle('env:get', async (_, name: string) => {
    return process.env[name] || null
})

// Open file dialog
ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openFile'],
        filters: [
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] },
            { name: 'Executables', extensions: ['exe', 'lnk', 'bat', 'cmd'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    })
    return result.canceled ? null : result.filePaths[0]
})

// Save/load user data
const userDataPath = path.join(app.getPath('userData'), 'user-data.json')

ipcMain.handle('userData:load', async () => {
    try {
        if (!fs.existsSync(userDataPath)) return null
        const raw = await fs.promises.readFile(userDataPath, 'utf-8')
        return JSON.parse(raw)
    } catch {
        return null
    }
})

ipcMain.handle('userData:save', async (_, data: any) => {
    try {
        const json = JSON.stringify(data)
        const tmp = `${userDataPath}.tmp`
        await fs.promises.writeFile(tmp, json, 'utf-8')
        await fs.promises.rename(tmp, userDataPath)
        return true
    } catch {
        return false
    }
})

// HTTP fetch handler - bypasses CORS for external API calls
ipcMain.handle('http:fetch', async (_, url: string, options?: { method?: string, headers?: Record<string, string>, body?: string }) => {
    try {
        const https = await import('https')
        const http = await import('http')

        return new Promise((resolve, reject) => {
            const urlObj = new URL(url)
            const isHttps = urlObj.protocol === 'https:'
            const lib = isHttps ? https : http

            const requestOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: options?.method || 'GET',
                headers: {
                    'User-Agent': 'UnifiedLauncher/1.0',
                    ...options?.headers
                }
            }

            const req = lib.request(requestOptions, (res: any) => {
                let data = ''
                res.on('data', (chunk: any) => { data += chunk })
                res.on('end', () => {
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        data: data
                    })
                })
            })

            req.on('error', (error: any) => {
                console.error('HTTP fetch error:', error)
                resolve({ ok: false, status: 0, data: null, error: error.message })
            })

            if (options?.body) {
                req.write(options.body)
            }

            req.end()
        })
    } catch (error) {
        console.error('HTTP fetch error:', error)
        return { ok: false, status: 0, data: null, error: String(error) }
    }
})

// Open external URL in default browser
ipcMain.handle('shell:openExternal', async (_, url: string) => {
    await shell.openExternal(url)
})

// Steam OpenID Authentication
const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login'
const CALLBACK_PORT = 27891

let authServer: any = null

// Start Steam OpenID login - opens browser and waits for callback
ipcMain.handle('steam:login', async () => {
    const http = await import('http')

    return new Promise((resolve) => {
        // Create local server to receive callback
        authServer = http.createServer(async (req: any, res: any) => {
            const url = new URL(req.url, `http://localhost:${CALLBACK_PORT}`)

            if (url.pathname === '/callback') {
                // Extract Steam ID from OpenID response
                const claimedId = url.searchParams.get('openid.claimed_id')

                if (claimedId) {
                    // Extract Steam ID from claimed_id URL
                    // Format: https://steamcommunity.com/openid/id/76561198012345678
                    const steamIdMatch = claimedId.match(/\/id\/(\d+)/)
                    const steamId = steamIdMatch ? steamIdMatch[1] : null

                    // Send success page
                    res.writeHead(200, { 'Content-Type': 'text/html' })
                    res.end(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Login Successful</title>
                            <style>
                                body { 
                                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                                    display: flex; 
                                    justify-content: center; 
                                    align-items: center; 
                                    height: 100vh; 
                                    margin: 0;
                                    background: linear-gradient(135deg, #1b2838, #0a0a0f);
                                    color: white;
                                }
                                .container { text-align: center; }
                                h1 { color: #66c0f4; }
                                p { color: #8f98a0; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <h1>✓ Login Successful!</h1>
                                <p>You can close this window and return to Mix Launcher.</p>
                                <script>setTimeout(() => window.close(), 2000);</script>
                            </div>
                        </body>
                        </html>
                    `)

                    // Close server and resolve
                    authServer.close()
                    authServer = null
                    resolve({ success: true, steamId })
                } else {
                    res.writeHead(400, { 'Content-Type': 'text/html' })
                    res.end('<h1>Login Failed</h1><p>Could not get Steam ID</p>')
                    authServer.close()
                    authServer = null
                    resolve({ success: false, error: 'No Steam ID received' })
                }
            } else {
                res.writeHead(404)
                res.end('Not found')
            }
        })

        authServer.listen(CALLBACK_PORT, () => {
            console.log(`Steam auth callback server listening on port ${CALLBACK_PORT}`)

            // Build Steam OpenID login URL
            const returnUrl = `http://localhost:${CALLBACK_PORT}/callback`
            const params = new URLSearchParams({
                'openid.ns': 'http://specs.openid.net/auth/2.0',
                'openid.mode': 'checkid_setup',
                'openid.return_to': returnUrl,
                'openid.realm': `http://localhost:${CALLBACK_PORT}`,
                'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
                'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
            })

            const loginUrl = `${STEAM_OPENID_URL}?${params.toString()}`

            // Open Steam login in default browser
            shell.openExternal(loginUrl)
        })

        // Timeout after 5 minutes
        setTimeout(() => {
            if (authServer) {
                authServer.close()
                authServer = null
                resolve({ success: false, error: 'Login timeout' })
            }
        }, 5 * 60 * 1000)
    })
})

// Cancel Steam login
ipcMain.handle('steam:cancelLogin', async () => {
    if (authServer) {
        authServer.close()
        authServer = null
    }
    return true
})

// Check if logged in (has Steam ID stored)
ipcMain.handle('steam:getSession', async () => {
    try {
        if (fs.existsSync(userDataPath)) {
            const data = JSON.parse(fs.readFileSync(userDataPath, 'utf-8'))
            return data.settings?.steamId || null
        }
        return null
    } catch {
        return null
    }
})

// Auto-start functionality
ipcMain.handle('autoStart:set', async (_event, enable: boolean) => {
    try {
        app.setLoginItemSettings({
            openAtLogin: enable,
            openAsHidden: false
        })
        return true
    } catch (error) {
        console.error('Error setting auto-start:', error)
        return false
    }
})

ipcMain.handle('autoStart:get', async () => {
    try {
        const settings = app.getLoginItemSettings()
        return settings.openAtLogin
    } catch (error) {
        console.error('Error getting auto-start:', error)
        return false
    }
})
