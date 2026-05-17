import { app } from 'electron'
import fs from 'fs'
import path from 'path'
const LEGENDARY_REPO = 'legendary-gl/legendary'

export function getDownloadedLegendaryPath(): string {
    return path.join(app.getPath('userData'), 'legendary', 'legendary.exe')
}

async function fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Unified-Launcher' }
    })
    if (!res.ok) {
        throw new Error(`GitHub API error: ${res.status}`)
    }
    return res.json() as Promise<T>
}

export async function downloadLegendaryWindows(onProgress?: (message: string) => void): Promise<string> {
    if (process.platform !== 'win32') {
        throw new Error('Automatic Legendary download is only supported on Windows.')
    }

    const dest = getDownloadedLegendaryPath()
    const dir = path.dirname(dest)
    fs.mkdirSync(dir, { recursive: true })

    onProgress?.('Finding latest Legendary release...')
    const release = await fetchJson<{
        assets: Array<{ name: string; browser_download_url: string }>
    }>(`https://api.github.com/repos/${LEGENDARY_REPO}/releases/latest`)

    const asset = release.assets.find(
        a => /legendary.*\.exe$/i.test(a.name) || a.name === 'legendary.exe'
    )
    if (!asset) {
        throw new Error('Could not find a Windows Legendary binary in the latest release.')
    }

    onProgress?.(`Downloading ${asset.name}...`)
    const fileRes = await fetch(asset.browser_download_url)
    if (!fileRes.ok || !fileRes.body) {
        throw new Error(`Download failed: ${fileRes.status}`)
    }

    const tmp = `${dest}.download`
    const buffer = Buffer.from(await fileRes.arrayBuffer())
    fs.writeFileSync(tmp, buffer)
    if (fs.existsSync(dest)) {
        fs.unlinkSync(dest)
    }
    fs.renameSync(tmp, dest)

    onProgress?.('Download complete.')
    return dest
}
