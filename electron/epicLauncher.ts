import { spawn } from 'child_process'
import fs from 'fs'
import { launchGameCommand, launchLegendaryHidden } from './launchGame'
import { resolveLegendaryExecutable } from './legendary'

/** Playnite-compatible install URI — app id only, action=install (opens game install page in EGL). */
export function buildEpicInstallUri(appName: string): string {
    const app = appName.trim()
    if (!app) return ''
    return `com.epicgames.launcher://apps/${encodeURIComponent(app)}?action=install`
}

export function buildEpicLauncherUri(
    namespace: string,
    catalogItemId: string,
    appName: string,
    mode: 'launch' | 'install' = 'launch'
): string {
    const app = appName.trim()
    if (mode === 'install') {
        return buildEpicInstallUri(app)
    }
    const ns = namespace.trim()
    const cid = catalogItemId.trim()
    if (ns && cid && app) {
        const encodedPath = [ns, cid, app].map(part => encodeURIComponent(part)).join('%3A')
        return `com.epicgames.launcher://apps/${encodedPath}?action=launch&silent=true`
    }
    if (app) {
        return `com.epicgames.launcher://apps/${encodeURIComponent(app)}?action=launch&silent=true`
    }
    return ''
}

export function findEpicGamesLauncherExe(): string | null {
    if (process.platform !== 'win32') return null
    const defaults = [
        'C:\\Program Files (x86)\\Epic Games\\Launcher\\Portal\\Binaries\\Win32\\EpicGamesLauncher.exe',
        'C:\\Program Files (x86)\\Epic Games\\Launcher\\Portal\\Binaries\\Win64\\EpicGamesLauncher.exe',
        'C:\\Program Files\\Epic Games\\Launcher\\Portal\\Binaries\\Win64\\EpicGamesLauncher.exe'
    ]
    for (const exe of defaults) {
        if (fs.existsSync(exe)) return exe
    }
    return null
}

export async function openEpicGameInLauncher(payload: {
    appName: string
    namespace?: string
    catalogItemId?: string
    install?: boolean
    legendaryPath?: string
}): Promise<boolean> {
    const appName = payload.appName?.trim()
    if (!appName) return false

    const ns = payload.namespace?.trim()
    const cid = payload.catalogItemId?.trim()
    const install = payload.install === true

    if (install) {
        const installUris: string[] = [buildEpicInstallUri(appName)]
        if (ns && cid) {
            const encodedPath = [ns, cid, appName]
                .map(part => encodeURIComponent(part.trim()))
                .join('%3A')
            installUris.push(`com.epicgames.launcher://apps/${encodedPath}?action=install`)
        }
        for (const uri of installUris) {
            if (!uri) continue
            const ok = await launchGameCommand(uri)
            if (ok) return true
        }
    } else if (ns && cid) {
        const uri = buildEpicLauncherUri(ns, cid, appName, 'launch')
        if (uri) {
            const ok = await launchGameCommand(uri)
            if (ok) return true
        }
    } else {
        const uri = buildEpicLauncherUri('', '', appName, 'launch')
        if (uri) {
            const ok = await launchGameCommand(uri)
            if (ok) return true
        }
    }

    const resolved = await resolveLegendaryExecutable(payload.legendaryPath, { allowDownload: true })
    if (resolved) {
        try {
            const args = install ? ['install', appName, '-y'] : ['launch', appName, '-y']
            launchLegendaryHidden(resolved.executable, args)
            return true
        } catch (error) {
            console.error('Legendary fallback failed:', error)
        }
    }

    const launcher = findEpicGamesLauncherExe()
    if (launcher) {
        try {
            spawn(launcher, [], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
            return true
        } catch (error) {
            console.error('Epic Games Launcher spawn failed:', error)
        }
    }

    return false
}
