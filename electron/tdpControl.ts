import { execFile, execSync, spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export type TdpPresetId = 'eco' | 'balanced' | 'performance' | 'turbo' | 'custom'

export const TDP_PRESET_WATTS: Record<Exclude<TdpPresetId, 'custom'>, number> = {
    eco: 8,
    balanced: 15,
    performance: 25,
    turbo: 30
}

export interface TdpDetectResult {
    supported: boolean
    ryzenAdjFound: boolean
    ryzenAdjPath: string | null
    isAdmin: boolean
    message: string
}

export interface TdpApplyResult {
    success: boolean
    watts?: number
    error?: string
    elevated?: boolean
}

const COMMON_PATHS = [
    'C:\\Program Files\\RyzenAdj\\ryzenadj.exe',
    'C:\\Program Files (x86)\\RyzenAdj\\ryzenadj.exe',
    'C:\\Tools\\ryzenadj.exe',
    'C:\\RyzenAdj\\ryzenadj.exe'
]

export function resolveTdpWatts(preset: TdpPresetId, customWatts: number): number {
    const watts = preset === 'custom' ? customWatts : TDP_PRESET_WATTS[preset]
    return Math.min(45, Math.max(5, Math.round(watts)))
}

export function isWindowsAdmin(): boolean {
    if (process.platform !== 'win32') return false
    try {
        const out = execSync(
            'powershell -NoProfile -Command "[bool](([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator))"',
            { encoding: 'utf-8', timeout: 5000 }
        )
        return out.trim().toLowerCase() === 'true'
    } catch {
        return false
    }
}

function fileExists(p: string): boolean {
    try {
        return fs.existsSync(p) && fs.statSync(p).isFile()
    } catch {
        return false
    }
}

function findOnPath(): string | null {
    if (process.platform !== 'win32') return null
    try {
        const out = execSync('where ryzenadj 2>nul', { encoding: 'utf-8', timeout: 5000 })
        const line = out.split(/\r?\n/).find(l => l.trim().endsWith('.exe'))
        return line?.trim() || null
    } catch {
        return null
    }
}

export function findRyzenAdj(customPath?: string): string | null {
    if (process.platform !== 'win32') return null

    const candidates: string[] = []
    if (customPath?.trim()) {
        candidates.push(customPath.trim())
    }
    candidates.push(...COMMON_PATHS)
    const onPath = findOnPath()
    if (onPath) candidates.push(onPath)

    for (const candidate of candidates) {
        if (fileExists(candidate)) return candidate
    }
    return null
}

async function testRyzenAdj(exePath: string): Promise<boolean> {
    try {
        await execFileAsync(exePath, ['--info'], { timeout: 8000, windowsHide: true })
        return true
    } catch {
        return false
    }
}

export async function detectTdpSupport(customPath?: string): Promise<TdpDetectResult> {
    if (process.platform !== 'win32') {
        return {
            supported: false,
            ryzenAdjFound: false,
            ryzenAdjPath: null,
            isAdmin: false,
            message: 'TDP control is only available on Windows.'
        }
    }

    const isAdmin = isWindowsAdmin()
    const ryzenAdjPath = findRyzenAdj(customPath)

    if (!ryzenAdjPath) {
        return {
            supported: false,
            ryzenAdjFound: false,
            ryzenAdjPath: null,
            isAdmin,
            message: 'RyzenAdj not found. Install it for AMD Ryzen handhelds (ROG Ally, Legion Go, GPD Win, etc.).'
        }
    }

    const works = await testRyzenAdj(ryzenAdjPath)
    if (!works && !isAdmin) {
        return {
            supported: true,
            ryzenAdjFound: true,
            ryzenAdjPath,
            isAdmin: false,
            message: 'RyzenAdj found. Apply will request administrator approval (required on most devices).'
        }
    }

    if (!works) {
        return {
            supported: false,
            ryzenAdjFound: true,
            ryzenAdjPath,
            isAdmin,
            message: 'RyzenAdj was found but could not read SMU info. Run as administrator or check BIOS limits.'
        }
    }

    return {
        supported: true,
        ryzenAdjFound: true,
        ryzenAdjPath,
        isAdmin,
        message: isAdmin
            ? 'RyzenAdj ready — TDP can be applied without extra prompts.'
            : 'RyzenAdj ready. First apply may show a Windows administrator prompt.'
    }
}

function buildRyzenAdjArgs(watts: number): string[] {
    const mw = String(watts * 1000)
    return [`--stapm-limit=${mw}`, `--fast-limit=${mw}`, `--slow-limit=${mw}`]
}

function runDirect(exePath: string, args: string[]): Promise<TdpApplyResult> {
    return new Promise(resolve => {
        const child = spawn(exePath, args, { windowsHide: true })
        let stderr = ''
        child.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
        child.on('error', err => resolve({ success: false, error: err.message }))
        child.on('close', code => {
            if (code === 0) {
                resolve({ success: true, elevated: false })
            } else {
                resolve({
                    success: false,
                    error: stderr.trim() || `RyzenAdj exited with code ${code}`
                })
            }
        })
    })
}

function runElevated(exePath: string, args: string[]): Promise<TdpApplyResult> {
    return new Promise(resolve => {
        const argString = args.map(a => `'${a.replace(/'/g, "''")}'`).join(', ')
        const script = [
            `$p = Start-Process -FilePath '${exePath.replace(/'/g, "''")}'`,
            `-ArgumentList @(${argString})`,
            '-Verb RunAs -Wait -PassThru -WindowStyle Hidden',
            'if ($null -eq $p) { exit 1229 }',
            'exit $p.ExitCode'
        ].join(' ')

        const child = spawn(
            'powershell.exe',
            ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
            { windowsHide: true }
        )

        let stderr = ''
        child.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
        child.on('error', err => resolve({ success: false, error: err.message, elevated: true }))
        child.on('close', code => {
            if (code === 0) {
                resolve({ success: true, elevated: true })
            } else if (code === 1229) {
                resolve({ success: false, error: 'Administrator approval was cancelled.', elevated: true })
            } else {
                resolve({
                    success: false,
                    error: stderr.trim() || `RyzenAdj failed (code ${code ?? 'unknown'})`,
                    elevated: true
                })
            }
        })
    })
}

export async function applyTdpWatts(
    watts: number,
    options?: { ryzenAdjPath?: string; forceElevate?: boolean }
): Promise<TdpApplyResult> {
    if (process.platform !== 'win32') {
        return { success: false, error: 'TDP control is only available on Windows.' }
    }

    const clamped = Math.min(45, Math.max(5, Math.round(watts)))
    const exePath = findRyzenAdj(options?.ryzenAdjPath)
    if (!exePath) {
        return { success: false, error: 'RyzenAdj not found. Set the path in Handheld → TDP control.' }
    }

    const args = buildRyzenAdjArgs(clamped)
    const admin = isWindowsAdmin()

    let result: TdpApplyResult
    if (admin && !options?.forceElevate) {
        result = await runDirect(exePath, args)
        if (result.success) {
            return { ...result, watts: clamped }
        }
    }

    if (!admin) {
        result = await runDirect(exePath, args)
        if (result.success) {
            return { ...result, watts: clamped }
        }
    }

    result = await runElevated(exePath, args)
    if (result.success) {
        return { ...result, watts: clamped }
    }
    return result
}

export async function applyTdpFromPreset(
    preset: TdpPresetId,
    customWatts: number,
    ryzenAdjPath?: string
): Promise<TdpApplyResult> {
    const watts = resolveTdpWatts(preset, customWatts)
    return applyTdpWatts(watts, { ryzenAdjPath })
}
