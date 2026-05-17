import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

const execFileAsync = promisify(execFile)

export interface XboxGameEntry {
    id: string
    name: string
    launchCommand: string
    installPath?: string
}

function scriptPath(): string {
    return path.join(__dirname, 'scripts', 'scan-xbox-games.ps1')
}

function devScriptPath(): string {
    return path.join(app.getAppPath(), 'electron', 'scripts', 'scan-xbox-games.ps1')
}

function resolveScript(): string | null {
    const candidates = [scriptPath(), devScriptPath()]
    for (const p of candidates) {
        if (fs.existsSync(p)) return p
    }
    return null
}

function stripBom(text: string): string {
    return text.replace(/^\uFEFF/, '').trim()
}

function parsePowerShellJson(stdout: string): Array<{ Name: string; AppId: string; InstallPath?: string }> {
    const trimmed = stripBom(stdout)
    if (!trimmed) return []

    try {
        const parsed = JSON.parse(trimmed) as
            | { Name: string; AppId: string; InstallPath?: string }
            | Array<{ Name: string; AppId: string; InstallPath?: string }>
        return Array.isArray(parsed) ? parsed : [parsed]
    } catch (e) {
        console.error('Xbox JSON parse failed:', trimmed.slice(0, 500), e)
        return []
    }
}

function cleanDisplayName(rawName: string): string {
    const name = rawName.trim()
    if (!name || name.startsWith('@{')) return rawName
    return name
    .replace(/^Microsoft\./i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim() || rawName
}

function toLaunchCommand(appId: string): string {
    const id = appId.trim()
    if (/^https?:\/\//i.test(id)) return id
    if (id.toLowerCase().startsWith('shell:')) return id
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(id)) return id
    if (id.includes(':\\') || id.includes(':/')) return id
    if (id.includes('!')) return `shell:AppsFolder\\${id}`
    return `shell:AppsFolder\\${id}!App`
}

const BLOCKED_NAME = /^(ms-resource:|NVIDIA Control|Realtek|RealtekSemiconductor|Microsoft Edge|PowerShell|Quick Assist|Game Bar|Get Started|Click to Do|News$|Claude$|Power Automate|Gaming Services|DTS Audio|Armoury Crate|Windows 11 Installation|Microsoft OneDrive|EA app$|Solitaire)/i

function toGameEntry(row: { Name: string; AppId: string; InstallPath?: string }): XboxGameEntry | null {
    if (!row?.Name || !row?.AppId) return null
    const name = cleanDisplayName(row.Name)
    if (name.length < 2 || BLOCKED_NAME.test(name)) return null
    if (/immersivecontrolpanel|AccountsControl|ParentalControls|CredDialogHost|WebExperienceHost|WindowsInstallationAssistant|OneDriveSetup|Package Cache|Realtek|NVIDIACorp\.NVIDIAControlPanel/i.test(row.AppId)) {
        return null
    }

    const launchCommand = toLaunchCommand(row.AppId)
    const idSource = row.AppId + row.Name
    const safeId = Buffer.from(idSource).toString('base64url').slice(0, 48)

    return {
        id: `xbox_${safeId}`,
        name,
        launchCommand,
        installPath: row.InstallPath || undefined
    }
}

async function listViaPowerShellFile(): Promise<XboxGameEntry[]> {
    if (process.platform !== 'win32') return []

    const script = resolveScript()
    if (!script) {
        console.error('Xbox scan script not found')
        return []
    }

    try {
        const { stdout, stderr } = await execFileAsync(
            'powershell.exe',
            ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script],
            { encoding: 'utf-8', maxBuffer: 30 * 1024 * 1024, timeout: 180_000, windowsHide: true }
        )

        if (stderr?.trim()) {
            console.warn('Xbox scan stderr:', stderr.slice(0, 500))
        }

        const rows = parsePowerShellJson(stdout)
        console.log(`Xbox scan: PowerShell returned ${rows.length} raw entries`)

        const games: XboxGameEntry[] = []
        const seenIds = new Set<string>()
        const seenNames = new Set<string>()

        for (const row of rows) {
            const entry = toGameEntry(row)
            if (!entry) continue
            if (seenIds.has(entry.id)) continue
            const nameKey = entry.name.toLowerCase()
            if (seenNames.has(nameKey)) continue
            seenIds.add(entry.id)
            seenNames.add(nameKey)
            games.push(entry)
        }

        return games
    } catch (e) {
        console.error('Xbox PowerShell scan failed:', e)
        return []
    }
}

export async function listXboxInstalledGames(): Promise<XboxGameEntry[]> {
    if (process.platform !== 'win32') return []

    const games = await listViaPowerShellFile()
    return games.sort((a, b) => a.name.localeCompare(b.name))
}
