import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFile, execSync, spawn } from 'child_process'
import { promisify } from 'util'
import { launchGameCommand } from './launchGame'

const execFileAsync = promisify(execFile)

export interface GogGalaxyOwnedGame {
    releaseKey: string
    productId: string
    title: string
}

export interface GogGalaxyStatusResult {
    available: boolean
    databasePath: string | null
    gamesAvailable?: number
    error?: string
}

function windowsProgramData(): string {
    return (
        process.env.ProgramData ||
        process.env.ALLUSERSPROFILE ||
        path.join(process.env.SystemDrive || 'C:', 'ProgramData')
    )
}

function findDbInTree(root: string, depth = 0): string | null {
    if (depth > 6 || !fs.existsSync(root)) return null
    const direct = path.join(root, 'galaxy-2.0.db')
    if (fs.existsSync(direct)) return direct

    let entries: fs.Dirent[]
    try {
        entries = fs.readdirSync(root, { withFileTypes: true })
    } catch {
        return null
    }

    for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const name = entry.name.toLowerCase()
        if (name === 'webcache' || name === 'logs' || name.startsWith('.')) continue
        const found = findDbInTree(path.join(root, entry.name), depth + 1)
        if (found) return found
    }
    return null
}

function galaxyDbFromRegistry(): string | null {
    if (process.platform !== 'win32') return null
    const keys = [
        'HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\GalaxyClient',
        'HKLM\\SOFTWARE\\GOG.com\\GalaxyClient'
    ]
    for (const key of keys) {
        try {
            const out = execSync(`reg query "${key}"`, { encoding: 'utf8', windowsHide: true })
            const line =
                out
                    .split(/\r?\n/)
                    .map(l => l.trim())
                    .find(l => /^(installPath|rootPath|path)\s+REG_/i.test(l)) || ''
            const match = line.match(/REG_\w+\s+(.+)$/i)
            if (!match) continue
            const base = match[1].trim().replace(/"/g, '')
            const candidates = [
                path.join(base, 'storage', 'galaxy-2.0.db'),
                path.join(base, 'Galaxy', 'storage', 'galaxy-2.0.db'),
                path.join(path.dirname(base), 'storage', 'galaxy-2.0.db')
            ]
            for (const candidate of candidates) {
                if (fs.existsSync(candidate)) return candidate
            }
        } catch {
            /* key missing */
        }
    }
    return null
}

export function findGalaxyDatabasePath(customPath?: string): string | null {
    const trimmed = customPath?.trim()
    if (trimmed) {
        return fs.existsSync(trimmed) ? trimmed : null
    }

    const candidates = [
        path.join(windowsProgramData(), 'GOG.com', 'Galaxy', 'storage', 'galaxy-2.0.db'),
        path.join(os.homedir(), 'AppData', 'Local', 'GOG.com', 'Galaxy', 'storage', 'galaxy-2.0.db'),
        path.join(os.homedir(), 'AppData', 'Roaming', 'GOG.com', 'Galaxy', 'storage', 'galaxy-2.0.db'),
        galaxyDbFromRegistry()
    ]

    for (const candidate of candidates) {
        if (candidate && fs.existsSync(candidate)) return candidate
    }

    const searchRoots = [
        path.join(windowsProgramData(), 'GOG.com'),
        path.join(os.homedir(), 'AppData', 'Local', 'GOG.com'),
        path.join(os.homedir(), 'AppData', 'Roaming', 'GOG.com')
    ]
    for (const root of searchRoots) {
        const found = findDbInTree(root)
        if (found) return found
    }

    return null
}

export function releaseKeyToProductId(releaseKey: string): string {
    const key = releaseKey.trim()
    const gogMatch = key.match(/^gog_(\d+)/i)
    if (gogMatch) return gogMatch[1]
    const tailDigits = key.match(/(\d{8,})$/)
    if (tailDigits) return tailDigits[1]
    return key.replace(/^gog_/i, '')
}

function resolveGogReaderScript(): string {
    const candidates = [
        path.join(__dirname, 'scripts', 'read-gog-library.mjs'),
        path.join(app.getAppPath(), 'electron', 'scripts', 'read-gog-library.mjs'),
        path.join(__dirname, '..', 'electron', 'scripts', 'read-gog-library.mjs')
    ]
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate
    }
    throw new Error('GOG library reader script is missing from the app install.')
}

/** Run sql.js in a child Node process so Vite does not bundle it (avoids "exports" crash). */
async function readGogGamesFromDatabase(databasePath: string): Promise<GogGalaxyOwnedGame[]> {
    const script = resolveGogReaderScript()
    const env = {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1'
    }

    const { stdout, stderr } = await execFileAsync(process.execPath, [script, databasePath], {
        env,
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
        timeout: 120_000,
        encoding: 'utf8'
    })

    const trimmed = stdout.trim()
    if (!trimmed) {
        const errText = (stderr || '').trim()
        throw new Error(errText || 'GOG library reader returned no data')
    }

    const parsed = JSON.parse(trimmed) as GogGalaxyOwnedGame[]
    if (!Array.isArray(parsed)) {
        throw new Error('Invalid GOG library reader output')
    }
    return parsed
}

export async function getGogGalaxyStatus(customDbPath?: string): Promise<GogGalaxyStatusResult> {
    const databasePath = findGalaxyDatabasePath(customDbPath)
    if (!databasePath) {
        return {
            available: false,
            databasePath: null,
            error:
                'GOG Galaxy library not found. Install GOG Galaxy, sign in, and open it once so your games sync locally.'
        }
    }

    try {
        const games = await readGogGamesFromDatabase(databasePath)
        return {
            available: true,
            databasePath,
            gamesAvailable: games.length,
            error:
                games.length === 0
                    ? 'No GOG games in Galaxy database yet. Open GOG Galaxy while signed in, wait for sync, then Detect again.'
                    : undefined
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const hint = /locked|busy|access/i.test(message)
            ? ' Try closing GOG Galaxy, then click Detect again.'
            : ''
        return {
            available: true,
            databasePath,
            error: message + hint
        }
    }
}

export function findGalaxyClientExe(): string | null {
    const defaults = [
        'C:\\Program Files (x86)\\GOG Galaxy\\GalaxyClient.exe',
        'C:\\Program Files\\GOG Galaxy\\GalaxyClient.exe'
    ]
    for (const exe of defaults) {
        if (fs.existsSync(exe)) return exe
    }

    if (process.platform !== 'win32') return null
    const keys = [
        'HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\GalaxyClient',
        'HKLM\\SOFTWARE\\GOG.com\\GalaxyClient'
    ]
    for (const key of keys) {
        try {
            const out = execSync(`reg query "${key}"`, { encoding: 'utf8', windowsHide: true })
            const line =
                out
                    .split(/\r?\n/)
                    .map(l => l.trim())
                    .find(l => /^(installPath|rootPath|path)\s+REG_/i.test(l)) || ''
            const match = line.match(/REG_\w+\s+(.+)$/i)
            if (!match) continue
            const base = match[1].trim().replace(/"/g, '')
            const candidates = [
                path.join(base, 'GalaxyClient.exe'),
                path.join(base, 'GOG Galaxy', 'GalaxyClient.exe'),
                path.join(path.dirname(base), 'GalaxyClient.exe')
            ]
            for (const exe of candidates) {
                if (fs.existsSync(exe)) return exe
            }
        } catch {
            /* key missing */
        }
    }
    return null
}

/** Open owned game in Galaxy (library view with Install), not the store overview. */
export async function openGogGameInGalaxy(payload: {
    uri?: string
    releaseKey?: string
    productId?: string
}): Promise<boolean> {
    const releaseKey = payload.releaseKey?.trim()
    const productId = payload.productId?.trim()
    const uri =
        payload.uri?.trim() ||
        (releaseKey ? `goggalaxy://openGameView/${releaseKey}` : '') ||
        (productId ? `goggalaxy://openGameView/${productId}` : '')

    if (uri.startsWith('goggalaxy://')) {
        const ok = await launchGameCommand(uri)
        if (ok) return true
    }

    const client = findGalaxyClientExe()
    if (client && productId) {
        try {
            spawn(client, ['/command=launch', `/gameId=${productId}`], {
                detached: true,
                stdio: 'ignore',
                windowsHide: true
            }).unref()
            return true
        } catch (error) {
            console.error('GalaxyClient launch failed:', error)
        }
    }

    return false
}

export async function fetchGogGalaxyOwnedGames(customDbPath?: string): Promise<GogGalaxyOwnedGame[]> {
    const databasePath = findGalaxyDatabasePath(customDbPath)
    if (!databasePath) {
        throw new Error(
            'GOG Galaxy not found. Install GOG Galaxy, sign in, open the app once, then try Sync Library again.'
        )
    }

    return readGogGamesFromDatabase(databasePath)
}
