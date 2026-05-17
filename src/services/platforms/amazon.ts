import { Game, Platform } from '../types/game'

interface AmazonFuel {
    Main: {
        Command: string
        Args?: string[]
    }
    ProductTitle: string
    InstallDirectory: string
    ProductId: string
}

export async function detectAmazonGames(): Promise<Game[]> {
    const games: Game[] = []

    try {
        // Amazon Games are typically installed in AppData
        const localAppData = await window.electronAPI.getEnv('LOCALAPPDATA')

        if (!localAppData) return games

        // Check Amazon Games installation directory
        const amazonPaths = [
            `${localAppData}\\Amazon Games\\Library`,
            'C:\\Amazon Games\\Library',
            'D:\\Amazon Games\\Library',
            'E:\\Amazon Games\\Library'
        ]

        for (const amazonPath of amazonPaths) {
            if (await window.electronAPI.exists(amazonPath)) {
                const folders = await window.electronAPI.readDir(amazonPath)

                for (const folder of folders) {
                    const gamePath = `${amazonPath}\\${folder}`
                    const fuelPath = `${gamePath}\\fuel.json`

                    if (await window.electronAPI.exists(fuelPath)) {
                        const fuelContent = await window.electronAPI.readFile(fuelPath)

                        if (fuelContent) {
                            try {
                                const fuel: AmazonFuel = JSON.parse(fuelContent)

                                games.push({
                                    id: `amazon_${fuel.ProductId}`,
                                    name: fuel.ProductTitle,
                                    platform: 'amazon' as Platform,
                                    installPath: fuel.InstallDirectory || gamePath,
                                    launchCommand: `amazon-games://play/${fuel.ProductId}`,
                                    addedDate: new Date().toISOString()
                                })
                            } catch (e) {
                                console.error('Error parsing Amazon fuel.json:', folder, e)
                            }
                        }
                    }
                }
            }
        }

        // Also check Amazon Games client database
        const amazonDbPath = `${localAppData}\\Amazon Games\\Data\\Games\\Sql\\GameInstallInfo.sqlite`

        // Note: SQLite reading would require additional setup
        // For now, we rely on fuel.json files

    } catch (error) {
        console.error('Error detecting Amazon games:', error)
    }

    return games
}
