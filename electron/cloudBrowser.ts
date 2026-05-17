import { BrowserWindow, app } from 'electron'
import path from 'path'

let cloudWindow: BrowserWindow | null = null

function isHttpUrl(url: string): boolean {
    return /^https?:\/\//i.test(url.trim())
}

export function closeCloudBrowser(): void {
    if (cloudWindow && !cloudWindow.isDestroyed()) {
        cloudWindow.close()
    }
    cloudWindow = null
}

/** Open a cloud gaming URL in a fullscreen browser window. */
export function openCloudBrowserFullscreen(
    url: string,
    title?: string,
    onClosed?: () => void
): boolean {
    const target = url.trim()
    if (!isHttpUrl(target)) {
        return false
    }

    if (cloudWindow && !cloudWindow.isDestroyed()) {
        cloudWindow.focus()
        void cloudWindow.loadURL(target)
        if (!cloudWindow.isFullScreen()) {
            cloudWindow.setFullScreen(true)
        }
        return true
    }

    const isDev = !app.isPackaged
    cloudWindow = new BrowserWindow({
        title: title?.trim() || 'Cloud Gaming',
        fullscreen: true,
        autoHideMenuBar: true,
        backgroundColor: '#000000',
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        },
        icon: path.join(__dirname, isDev ? '../public/icon.png' : '../dist/icon.png')
    })

    cloudWindow.setMenu(null)
    cloudWindow.on('closed', () => {
        cloudWindow = null
        onClosed?.()
    })

    cloudWindow.webContents.on('before-input-event', (_event, input) => {
        if (input.key === 'Escape' && input.type === 'keyDown' && cloudWindow && !cloudWindow.isDestroyed()) {
            if (cloudWindow.isFullScreen()) {
                cloudWindow.setFullScreen(false)
            }
            cloudWindow.close()
        }
    })

    cloudWindow.once('ready-to-show', () => {
        cloudWindow?.show()
        cloudWindow?.setFullScreen(true)
    })

    void cloudWindow.loadURL(target)
    return true
}
