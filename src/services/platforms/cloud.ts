import { Game } from '../../types/game'
import { buildCloudGames } from '../../data/cloudServices'

export async function detectCloudGames(): Promise<Game[]> {
    return buildCloudGames()
}
