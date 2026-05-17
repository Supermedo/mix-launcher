import { shell } from 'electron'
import { spawn, execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

function isUrl(command: string): boolean {
    return /^https?:\/\//i.test(command.trim())
}

function isProtocol(command: string): boolean {
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(command.trim()) && !isUrl(command)
}

function isShellAppsFolder(command: string): boolean {
    return command.trim().toLowerCase().startsWith('shell:')
}

function quotePowerShellSingle(value: string): string {
    return `'${value.replace(/'/g, "''")}'`
}

/** Open custom protocol / http(s) URIs on Windows without a visible console. */
async function launchWindowsUri(target: string): Promise<void> {
    const errors: string[] = []

    try {
        await execFileAsync('rundll32', ['url.dll,FileProtocolHandler', target], {
            windowsHide: true,
            timeout: 15_000
        })
        return
    } catch (e) {
        errors.push(`rundll32: ${e instanceof Error ? e.message : String(e)}`)
    }

    try {
        await execFileAsync('cmd.exe', ['/d', '/c', 'start', '', target], {
            windowsHide: true,
            timeout: 15_000
        })
        return
    } catch (e) {
        errors.push(`cmd start: ${e instanceof Error ? e.message : String(e)}`)
    }

    try {
        const ok = await shell.openExternal(target)
        if (ok) return
        errors.push('shell.openExternal returned false')
    } catch (e) {
        errors.push(`openExternal: ${e instanceof Error ? e.message : String(e)}`)
    }

    throw new Error(errors.join('; ') || 'Windows URI launch failed')
}

async function openExternalHidden(command: string): Promise<boolean> {
    if (process.platform === 'win32' && (isProtocol(command) || isUrl(command))) {
        try {
            await launchWindowsUri(command)
            return true
        } catch (e) {
            console.error('Windows URI launch failed:', command, e)
            return false
        }
    }

    try {
        const ok = await shell.openExternal(command)
        if (ok) return true
    } catch (e) {
        console.warn('shell.openExternal failed:', e)
    }

    if (process.platform === 'win32') {
        try {
            await execFileAsync(
                'powershell.exe',
                [
                    '-NoProfile',
                    '-WindowStyle',
                    'Hidden',
                    '-Command',
                    `Start-Process ${quotePowerShellSingle(command)}`
                ],
                { windowsHide: true, timeout: 15_000 }
            )
            return true
        } catch (e) {
            console.error('Hidden Windows launch failed:', e)
        }
    }
    return false
}

export async function launchGameCommand(launchCommand: string, args?: string[]): Promise<boolean> {
    const command = (launchCommand || '').trim()
    if (!command) {
        console.error('launchGame: empty launch command')
        return false
    }

    try {
        if (isUrl(command) || isShellAppsFolder(command) || isProtocol(command)) {
            return await openExternalHidden(command)
        }

        // Win32 executable path
        if (command.includes('\\') || command.includes('/') || command.toLowerCase().endsWith('.exe')) {
            spawn(command, args || [], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
            return true
        }

        return await openExternalHidden(command)
    } catch (error) {
        console.error('Failed to launch:', command, error)
        return false
    }
}

/** Launch legendary.exe without a visible console window (Windows). */
export function launchLegendaryHidden(exe: string, args: string[]): void {
    if (process.platform === 'win32') {
        const argList = args.map(a => quotePowerShellSingle(a)).join(', ')
        const ps = `Start-Process -FilePath ${quotePowerShellSingle(exe)} -ArgumentList ${argList} -WindowStyle Hidden`
        spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
        }).unref()
        return
    }
    spawn(exe, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref()
}
