import { Game, Platform } from '../types/game'

export async function addManualGame(
    name: string,
    executablePath: string,
    args?: string[]
): Promise<Game> {
    const game: Game = {
        id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        platform: 'manual' as Platform,
        installPath: executablePath.substring(0, executablePath.lastIndexOf('\\')),
        launchCommand: executablePath,
        launchArgs: args,
        addedDate: new Date().toISOString()
    }

    return game
}

export async function importManualGames(games: Game[]): Promise<Game[]> {
    return games.filter(g => g.platform === 'manual')
}
