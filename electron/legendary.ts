import { app } from 'electron'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { downloadLegendaryWindows, getDownloadedLegendaryPath } from './legendaryDownload'

const execFileAsync = promisify(execFile)

export interface LegendaryStatusResult {
    available: boolean
    executable: string | null
    authenticated: boolean
    account?: string
    gamesAvailable?: number
    gamesInstalled?: number
    /** Shipped inside the installer (resources/legendary). */
    bundled?: boolean
    /** Downloaded once into app user data. */
    downloaded?: boolean
    error?: string
}

export interface LegendaryOwnedGame {
    app_name: string
    app_title?: string
    catalog_item_id?: string
    catalog_namespace?: string
    [key: string]: unknown
}

/** Legendary `list --json` uses metadata/asset_infos; top-level catalog fields are often missing. */
function slimLegendaryListEntry(g: LegendaryOwnedGame): LegendaryOwnedGame {
    const metadata = (g.metadata as Record<string, unknown> | undefined) ?? {}
    const assetInfos = g.asset_infos as
        | Record<string, { namespace?: string; catalog_item_id?: string }>
        | undefined
    const winAsset = assetInfos?.Windows ?? assetInfos?.windows

    const catalog_item_id =
        g.catalog_item_id ||
        winAsset?.catalog_item_id ||
        (typeof metadata.id === 'string' ? metadata.id : undefined)
    const catalog_namespace =
        g.catalog_namespace ||
        (typeof g.namespace === 'string' ? g.namespace : undefined) ||
        winAsset?.namespace ||
        (typeof metadata.namespace === 'string' ? metadata.namespace : undefined)

    return {
        app_name: g.app_name,
        app_title: g.app_title,
        catalog_item_id,
        catalog_namespace
    }
}

export interface LegendaryInstalledGame {
    app_name: string
    title?: string
    install_path?: string
    version?: string
    platform?: string
}

function parseJsonOutput(stdout: string): unknown {
    const trimmed = stdout.trim()
    if (!trimmed) {
        throw new Error('Legendary returned no output')
    }
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        return JSON.parse(trimmed)
    }
    const startObj = trimmed.indexOf('{')
    const startArr = trimmed.indexOf('[')
    const start =
        startObj >= 0 && (startArr < 0 || startObj < startArr)
            ? startObj
            : startArr >= 0
              ? startArr
              : -1
    if (start < 0) {
        throw new Error(trimmed.slice(0, 200) || 'Invalid Legendary output')
    }
    return JSON.parse(trimmed.slice(start))
}

const EPIC_SIGN_IN_REQUIRED =
    'Not signed in to Epic yet. Go to Settings → Epic Games → Sign in to Epic, complete login in the window that opens, then click Sync Library again.'

/** Legendary status JSON uses account: "<not logged in>" when there is no session. */
export function isLegendaryAccountLoggedIn(account?: string | null): boolean {
    const value = (account ?? '').trim()
    if (!value) return false
    const lower = value.toLowerCase()
    if (lower.includes('not logged in')) return false
    if (lower === 'offline' || lower === 'n/a') return false
    return true
}

function bufferToText(value: unknown): string {
    if (!value) return ''
    if (Buffer.isBuffer(value)) return value.toString('utf8')
    return String(value)
}

function isLegendaryAuthFailure(text: string): boolean {
    return /No saved credentials|Login failed|not logged in|Failed to execute script/i.test(text)
}

function toLegendaryUserError(error: unknown, stderr?: unknown, stdout?: unknown): Error {
    const stderrText = bufferToText(stderr).trim()
    const stdoutText = bufferToText(stdout).trim()
    const blob = [error instanceof Error ? error.message : String(error), stderrText, stdoutText].join('\n')
    if (isLegendaryAuthFailure(blob)) {
        return new Error(EPIC_SIGN_IN_REQUIRED)
    }
    const stderrLines = stderrText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const lastStderr = stderrLines[stderrLines.length - 1]
    if (lastStderr && lastStderr.length < 500 && !/^\[/.test(lastStderr)) {
        return new Error(lastStderr)
    }
    const msg = error instanceof Error ? error.message : String(error)
    if (msg && !msg.includes('Command failed') && msg.length < 500) {
        return new Error(msg)
    }
    if (stderrLines.length > 0) {
        const info = stderrLines.find(l => /ERROR|error|failed/i.test(l)) || stderrLines[stderrLines.length - 1]
        if (info) return new Error(info.replace(/^\[[^\]]+\]\s*/, ''))
    }
    return new Error('Epic library sync failed. Try signing in again under Settings → Epic Games.')
}

async function canRun(exe: string): Promise<boolean> {
    try {
        await execFileAsync(exe, ['--version'], { timeout: 15_000, windowsHide: true, encoding: 'utf8' })
        return true
    } catch {
        return false
    }
}

/** Paths checked for legendary.exe shipped with the installer or dev resources folder. */
export function getBundledLegendaryCandidates(): string[] {
    const candidates: string[] = []
    if (process.resourcesPath) {
        candidates.push(path.join(process.resourcesPath, 'legendary', 'legendary.exe'))
    }
    try {
        candidates.push(path.join(app.getAppPath(), 'resources', 'legendary', 'legendary.exe'))
    } catch {
        /* app not ready */
    }
    candidates.push(path.join(__dirname, '..', 'resources', 'legendary', 'legendary.exe'))
    candidates.push(path.join(__dirname, '..', '..', 'resources', 'legendary', 'legendary.exe'))
    return [...new Set(candidates)]
}

export function getBundledLegendaryPath(): string | null {
    for (const candidate of getBundledLegendaryCandidates()) {
        if (fs.existsSync(candidate)) return candidate
    }
    return null
}

export type ResolvedLegendary = {
    executable: string
    bundled: boolean
    downloaded: boolean
}

export async function resolveLegendaryExecutable(
    customPath?: string,
    options?: { allowDownload?: boolean }
): Promise<ResolvedLegendary | null> {
    const trimmed = customPath?.trim()
    if (trimmed) {
        if (await canRun(trimmed)) {
            return { executable: trimmed, bundled: false, downloaded: false }
        }
        // Invalid custom path — fall back to bundled/downloaded instead of failing entirely
    }

    const bundled = getBundledLegendaryPath()
    if (bundled && (await canRun(bundled))) {
        return { executable: bundled, bundled: true, downloaded: false }
    }

    const downloaded = getDownloadedLegendaryPath()
    if (fs.existsSync(downloaded) && (await canRun(downloaded))) {
        return { executable: downloaded, bundled: false, downloaded: true }
    }

    const home = os.homedir()
    const candidates: string[] = ['legendary', 'legendary.exe']

    if (process.platform === 'win32') {
        for (const ver of ['312', '311', '310', '39']) {
            candidates.push(path.join(home, 'AppData', 'Roaming', 'Python', `Python${ver}`, 'Scripts', 'legendary.exe'))
            candidates.push(path.join(home, 'AppData', 'Local', 'Programs', 'Python', `Python${ver}`, 'Scripts', 'legendary.exe'))
        }
        candidates.push(path.join(home, '.local', 'bin', 'legendary.exe'))
    } else {
        candidates.push(path.join(home, '.local', 'bin', 'legendary'))
    }

    for (const exe of candidates) {
        if (exe.includes(path.sep) && !fs.existsSync(exe)) continue
        if (await canRun(exe)) {
            return { executable: exe, bundled: false, downloaded: false }
        }
    }

    if (options?.allowDownload && process.platform === 'win32') {
        try {
            const dest = await downloadLegendaryWindows()
            if (await canRun(dest)) {
                return { executable: dest, bundled: false, downloaded: true }
            }
        } catch (error) {
            console.error('Legendary auto-download failed:', error)
        }
    }

    return null
}

async function runLegendaryProcess(
    exe: string,
    args: string[],
    timeoutMs: number
): Promise<{ stdout: string; stderr: string }> {
    const { stdout, stderr } = await execFileAsync(exe, args, {
        timeout: timeoutMs,
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
        encoding: 'utf8',
        env: process.env
    })
    return { stdout: stdout ?? '', stderr: stderr ?? '' }
}

async function runLegendary(exe: string, args: string[], timeoutMs: number): Promise<string> {
    try {
        const { stdout, stderr } = await runLegendaryProcess(exe, args, timeoutMs)
        const trimmedStdout = stdout.trim()
        const trimmedStderr = stderr.trim()
        if (trimmedStdout) {
            if (isLegendaryAuthFailure(stdout) && !trimmedStdout.startsWith('[') && !trimmedStdout.startsWith('{')) {
                throw toLegendaryUserError(null, stderr, stdout)
            }
            return [stdout, stderr].filter(Boolean).join('\n')
        }
        const combined = [stdout, stderr].filter(Boolean).join('\n').trim()
        if (!combined) {
            throw new Error('Legendary returned no output')
        }
        if (isLegendaryAuthFailure(combined) && !combined.startsWith('[') && !combined.startsWith('{')) {
            throw toLegendaryUserError(null, stderr, stdout)
        }
        return combined
    } catch (error: unknown) {
        const execErr = error as { stderr?: unknown; stdout?: unknown }
        throw toLegendaryUserError(error, execErr.stderr, execErr.stdout)
    }
}

async function assertLegendaryLoggedIn(executable: string): Promise<void> {
    try {
        const { stdout, stderr } = await runLegendaryProcess(executable, ['status', '--json'], 60_000)
        if (!stdout.trim()) {
            throw new Error(stderr.trim() || EPIC_SIGN_IN_REQUIRED)
        }
        const data = parseJsonOutput(stdout) as { account?: string }
        if (!isLegendaryAccountLoggedIn(data.account)) {
            throw new Error(EPIC_SIGN_IN_REQUIRED)
        }
    } catch (error) {
        if (error instanceof Error && error.message === EPIC_SIGN_IN_REQUIRED) throw error
        throw toLegendaryUserError(error)
    }
}

export async function getLegendaryStatus(
    customPath?: string,
    options?: { allowDownload?: boolean }
): Promise<LegendaryStatusResult> {
    const resolved = await resolveLegendaryExecutable(customPath, options)
    if (!resolved) {
        return {
            available: false,
            executable: null,
            authenticated: false,
            error:
                process.platform === 'win32'
                    ? 'Epic sync tool not found. Reinstall the app or use “Download Epic sync tool” below.'
                    : 'Epic full-library sync requires Legendary on PATH (legendary-gl). Installed Epic games still work via Scan.'
        }
    }

    const { executable, bundled, downloaded } = resolved

    try {
        const { stdout, stderr } = await runLegendaryProcess(executable, ['status', '--json'], 60_000)
        if (!stdout.trim()) {
            throw new Error(stderr.trim() || 'Legendary status returned no data')
        }
        const data = parseJsonOutput(stdout) as {
            account?: string
            games_available?: number
            games_installed?: number
        }
        const account = (data.account || '').trim()
        const authenticated = isLegendaryAccountLoggedIn(account)
        return {
            available: true,
            executable,
            authenticated,
            account: authenticated ? account : undefined,
            gamesAvailable: data.games_available,
            gamesInstalled: data.games_installed,
            bundled,
            downloaded
        }
    } catch (error) {
        return {
            available: true,
            executable,
            authenticated: false,
            bundled,
            downloaded,
            error: error instanceof Error ? error.message : String(error)
        }
    }
}

export async function fetchLegendaryOwnedGames(
    customPath?: string,
    options?: { allowDownload?: boolean }
): Promise<{ games: LegendaryOwnedGame[]; installed: LegendaryInstalledGame[] }> {
    const resolved = await resolveLegendaryExecutable(customPath, {
        allowDownload: options?.allowDownload ?? true
    })
    if (!resolved) {
        throw new Error('Epic sync tool not available')
    }
    const { executable } = resolved

    await assertLegendaryLoggedIn(executable)

    const platform = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'Mac' : 'Linux'
    let games: LegendaryOwnedGame[]
    try {
        const { stdout, stderr } = await runLegendaryProcess(
            executable,
            ['list', '--json', '--platform', platform, '-y'],
            300_000
        )
        if (!stdout.trim()) {
            throw new Error(stderr.trim() || 'Legendary list returned no data')
        }
        const parsed = parseJsonOutput(stdout)
        games = Array.isArray(parsed) ? (parsed as LegendaryOwnedGame[]) : []
        if (!Array.isArray(parsed)) {
            throw new Error('Unexpected Legendary list output')
        }
    } catch (error) {
        const execErr = error as { stderr?: unknown; stdout?: unknown }
        throw toLegendaryUserError(error, execErr.stderr, execErr.stdout)
    }

    let installed: LegendaryInstalledGame[] = []
    try {
        const { stdout } = await runLegendaryProcess(executable, ['list-installed', '--json', '-y'], 120_000)
        if (stdout.trim()) {
            const parsed = parseJsonOutput(stdout)
            installed = Array.isArray(parsed) ? (parsed as LegendaryInstalledGame[]) : []
        }
    } catch {
        installed = []
    }

    const slimGames: LegendaryOwnedGame[] = games.map(g => slimLegendaryListEntry(g))

    const slimInstalled: LegendaryInstalledGame[] = installed.map(g => ({
        app_name: g.app_name,
        install_path: g.install_path,
        version: g.version
    }))

    return { games: slimGames, installed: slimInstalled }
}

export { downloadLegendaryWindows }

function quoteCmdArg(value: string): string {
    if (!/[\s"]/u.test(value)) return value
    return `"${value.replace(/"/g, '""')}"`
}

/** Visible console on Windows — embedded WebView often never appears when spawned from Electron. */
function startLegendaryAuthWindows(exe: string, mode: 'interactive' | 'import'): void {
    const args =
        mode === 'import'
            ? ['auth', '--import', '-y']
            : ['auth', '--disable-webview']
    const cmdLine = [quoteCmdArg(exe), ...args.map(quoteCmdArg)].join(' ')
    const loginUrl = 'https://legendary.gl/epiclogin'
    const intro =
        mode === 'import'
            ? [
                  'echo Importing your Epic Games Launcher session...',
                  'echo Make sure Epic Games Launcher is installed and you are logged in there.',
                  'echo.'
              ]
            : [
                  'echo Epic sign-in for Mix Launcher',
                  'echo.',
                  'echo Your browser should open for Epic login.',
                  `echo If it does not, open: ${loginUrl}`,
                  'echo.',
                  'echo Keep this window open until you see success or an error below.',
                  'echo.'
              ]
    const batch = [
        '@echo off',
        'title Mix Launcher - Epic Sign In',
        'echo.',
        ...intro,
        cmdLine,
        'echo.',
        'if errorlevel 1 (',
        '  echo Sign-in did not finish. Read any error above, then close this window.',
        '  echo Try again in Settings, or install Epic Launcher and use "Use Epic Launcher login".',
        ') else (',
        '  echo Done. Close this window, return to Settings, and click Sync Library.',
        ')',
        'echo.',
        'pause'
    ].join('\r\n')

    const batPath = path.join(app.getPath('temp'), `unified-launcher-epic-auth-${Date.now()}.bat`)
    fs.writeFileSync(batPath, batch, 'utf8')

    spawn('cmd.exe', ['/c', 'start', 'Mix Launcher - Epic Sign In', 'cmd', '/k', batPath], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false
    }).unref()
}

export function startLegendaryAuth(exe: string, mode: 'interactive' | 'import'): void {
    if (process.platform === 'win32') {
        startLegendaryAuthWindows(exe, mode)
        return
    }
    const args =
        mode === 'import' ? ['auth', '--import', '-y'] : ['auth', '--disable-webview']
    spawn(exe, args, { detached: true, stdio: 'inherit', cwd: path.dirname(exe) }).unref()
}

export async function legendaryLogout(exe: string): Promise<void> {
    await runLegendary(exe, ['auth', '--delete', '-y'], 30_000)
}
