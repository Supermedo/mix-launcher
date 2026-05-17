import type { Game } from '../types/game'
import { buildEpicLauncherUri } from '../services/epicApi'
import { buildGogGalaxyUri } from '../services/gogApi'

function command(game: Game): string {
    return (game.launchCommand || '').trim()
}

function isLegendaryCommand(cmd: string): boolean {
    return /^legendary:(launch|install):/i.test(cmd.trim())
}

function isEpicLauncherCommand(cmd: string): boolean {
    return /^epic-launcher:(install|launch):/i.test(cmd.trim())
}

/** Store / protocol launches — keep the launcher visible. */
export function isStoreOrProtocolLaunch(game: Game): boolean {
    const cmd = command(game)
    if (!cmd) return true
    if (/^https?:\/\//i.test(cmd)) return true
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(cmd)) return true
    if (/^com\.epicgames\.launcher:/i.test(cmd)) return true
    if (isLegendaryCommand(cmd)) return true
    if (isEpicLauncherCommand(cmd)) return true
    if (cmd.toLowerCase().startsWith('shell:')) return true
    return false
}

export function isSteamInstallLaunch(cmd: string): boolean {
    return /^steam:\/\/install\//i.test(cmd.trim())
}

function needsInstall(game: Game): boolean {
    return game.isInstalled !== true
}

export function resolveLaunchCommand(game: Game): string {
    const cmd = command(game)
    if (game.platform === 'steam' && needsInstall(game)) {
        const id = game.id.replace(/^steam_/, '')
        if (id) return `steam://install/${id}`
    }
    if (game.platform === 'gog') {
        const uri = buildGogGalaxyUri({
            gogProductId: game.gogProductId || game.id.replace(/^gog_/, ''),
            gogReleaseKey: game.gogReleaseKey
        })
        if (uri) {
            return needsInstall(game) ? `gog-galaxy:install:${uri}` : uri
        }
    }
    if (game.platform === 'epic') {
        const app = game.epicAppName || game.id.replace(/^epic_/, '')
        if (!app) return cmd
        if (needsInstall(game)) return `epic-launcher:install:${app}`
        const ns = game.epicCatalogNamespace
        const cid = game.epicCatalogItemId
        if (ns && cid) return buildEpicLauncherUri(ns, cid, app, 'launch')
        return `legendary:launch:${app}`
    }
    return cmd
}

export function shouldMinimizeLauncherAfterLaunch(game: Game): boolean {
    // Install / download — open store or Epic Launcher, keep Unified Launcher visible
    if (game.isInstalled !== true) return false

    const cmd = resolveLaunchCommand(game)
    if (!cmd || isSteamInstallLaunch(cmd)) return false
    if (isLegendaryCommand(cmd)) return false
    if (isStoreOrProtocolLaunch({ ...game, launchCommand: cmd })) return false
    return true
}
