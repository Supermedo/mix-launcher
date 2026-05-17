import { Game, Platform } from '../../types/game'

export async function detectEAGames(): Promise<Game[]> {
    const games: Game[] = []

    try {
        console.log('Detecting EA games...')

        // EA App stores game info in registry - check multiple locations
        const registryPaths = [
            'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\EA Games',
            'HKEY_LOCAL_MACHINE\\SOFTWARE\\EA Games',
            'HKEY_CURRENT_USER\\SOFTWARE\\EA Games',
            'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Electronic Arts\\EA Desktop\\InstallInfo',
            'HKEY_LOCAL_MACHINE\\SOFTWARE\\Electronic Arts\\EA Desktop',
            'HKEY_CURRENT_USER\\SOFTWARE\\Electronic Arts\\EA Desktop'
        ]

        // Also check EA Desktop/EA App installation folders
        const programData = await window.electronAPI.getEnv('PROGRAMDATA')
        const localAppData = await window.electronAPI.getEnv('LOCALAPPDATA')
        console.log('EA Detection - ProgramData:', programData, 'LocalAppData:', localAppData)

        // Check EA Desktop content folder
        if (localAppData) {
            const eaContentPath = `${localAppData}\\Electronic Arts\\EA Desktop\\IS`

            if (await window.electronAPI.exists(eaContentPath)) {
                const folders = await window.electronAPI.readDir(eaContentPath)

                for (const folder of folders) {
                    const installerDataPath = `${eaContentPath}\\${folder}\\installerdata.xml`

                    if (await window.electronAPI.exists(installerDataPath)) {
                        const content = await window.electronAPI.readFile(installerDataPath)

                        if (content) {
                            // Parse XML to get game info - simplified parsing
                            const titleMatch = content.match(/<title>([^<]+)<\/title>/i) ||
                                content.match(/<gameTitle[^>]*>([^<]+)<\/gameTitle>/i) ||
                                content.match(/<contentTitle>([^<]+)<\/contentTitle>/i)

                            if (titleMatch) {
                                const gameName = titleMatch[1].trim()

                                // Try to find content ID for launch URL
                                const contentIdMatch = content.match(/<contentID>([^<]+)<\/contentID>/i) ||
                                    content.match(/<softwareID>([^<]+)<\/softwareID>/i)

                                const contentId = contentIdMatch ? contentIdMatch[1] : folder

                                games.push({
                                    id: `ea_${folder}`,
                                    name: gameName,
                                    platform: 'ea' as Platform,
                                    installPath: `${eaContentPath}\\${folder}`,
                                    launchCommand: `origin://launchgame/${contentId}`,
                                    addedDate: new Date().toISOString()
                                })
                            }
                        }
                    }
                }
            }
        }

        // Also scan common EA installation directories
        const commonEAPaths = [
            'C:\\Program Files\\EA Games',
            'C:\\Program Files (x86)\\EA Games',
            'C:\\Program Files\\Electronic Arts',
            'C:\\Program Files (x86)\\Electronic Arts',
            'C:\\Program Files (x86)\\Origin Games',
            'C:\\Program Files\\Origin Games',
            'D:\\Origin Games',
            'E:\\Origin Games'
        ]

        for (const eaPath of commonEAPaths) {
            if (await window.electronAPI.exists(eaPath)) {
                const folders = await window.electronAPI.readDir(eaPath)

                for (const folder of folders) {
                    // Skip if already found
                    if (games.some(g => g.name.toLowerCase() === folder.toLowerCase())) continue

                    const gamePath = `${eaPath}\\${folder}`

                    // Check for common executable patterns
                    const files = await window.electronAPI.readDir(gamePath)
                    const hasExe = files.some(f => f.endsWith('.exe'))

                    if (hasExe && !folder.startsWith('__')) {
                        games.push({
                            id: `ea_${folder.replace(/\s+/g, '_')}`,
                            name: folder,
                            platform: 'ea' as Platform,
                            installPath: gamePath,
                            launchCommand: `origin://launchgame/${folder.replace(/\s+/g, '')}`,
                            addedDate: new Date().toISOString()
                        })
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error detecting EA games:', error)
    }

    return games
}
