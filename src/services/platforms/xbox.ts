import { Game, Platform } from '../../types/game'

interface XboxGameRow {
    id: string
    name: string
    launchCommand: string
    installPath?: string
}

export async function detectXboxGames(): Promise<Game[]> {
    if (!window.electronAPI?.xboxListInstalled) {
        console.log('Xbox: API not available')
        return []
    }

    try {
        console.log('Xbox: Scanning installed Game Pass / Microsoft Store games...')
        const rows: XboxGameRow[] = await window.electronAPI.xboxListInstalled()
        console.log(`Xbox: Found ${rows.length} titles`)

        const now = new Date().toISOString()
        return rows.map(row => ({
            id: row.id.startsWith('xbox_') ? row.id : `xbox_${row.id}`,
            name: row.name,
            platform: 'xbox' as Platform,
            installPath: row.installPath,
            launchCommand: row.launchCommand,
            isInstalled: true,
            addedDate: now,
            genres: ['Xbox / PC Game Pass']
        }))
    } catch (error) {
        console.error('Xbox detection failed:', error)
        return []
    }
}
