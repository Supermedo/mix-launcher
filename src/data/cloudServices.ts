import { Game, Platform } from '../types/game'

export interface CloudServiceDef {
    id: string
    name: string
    description: string
    launchCommand: string
    icon: string
    accentColor: string
    /** Optional desktop app path env hint */
    desktopEnvVar?: string
}

export const CLOUD_SERVICES: CloudServiceDef[] = [
    {
        id: 'cloud_geforce',
        name: 'GeForce NOW',
        description: 'NVIDIA cloud gaming — stream your PC library',
        launchCommand: 'https://play.geforcenow.com',
        icon: '☁️',
        accentColor: '#76b900',
        desktopEnvVar: 'LOCALAPPDATA'
    },
    {
        id: 'cloud_xbox',
        name: 'Xbox Cloud Gaming',
        description: 'Play Game Pass in the browser',
        launchCommand: 'https://www.xbox.com/play',
        icon: '🟢',
        accentColor: '#107c10'
    },
    {
        id: 'cloud_xbox_app',
        name: 'Xbox PC App',
        description: 'Game Pass, installs, and cloud play',
        launchCommand: 'shell:AppsFolder\\Microsoft.GamingApp_8wekyb3d8bbwe!Microsoft.Xbox.App',
        icon: '🎮',
        accentColor: '#107c10'
    },
    {
        id: 'cloud_boosteroid',
        name: 'Boosteroid',
        description: 'Cloud gaming across devices',
        launchCommand: 'https://cloud.boosteroid.com',
        icon: '🚀',
        accentColor: '#6c5ce7'
    },
    {
        id: 'cloud_luna',
        name: 'Amazon Luna',
        description: 'Amazon cloud gaming',
        launchCommand: 'https://luna.amazon.com',
        icon: '🌙',
        accentColor: '#9146ff'
    },
    {
        id: 'cloud_shadow',
        name: 'Shadow PC',
        description: 'Full Windows PC in the cloud',
        launchCommand: 'https://shadow.tech',
        icon: '💻',
        accentColor: '#1a1a2e'
    },
    {
        id: 'cloud_airgpu',
        name: 'AirGPU',
        description: 'Rent a cloud GPU session',
        launchCommand: 'https://www.airgpu.com',
        icon: '⚡',
        accentColor: '#00bcd4'
    },
    {
        id: 'cloud_playstation',
        name: 'PlayStation Plus Premium',
        description: 'Cloud stream select PS games (browser)',
        launchCommand: 'https://www.playstation.com/ps-plus/games/',
        icon: '🔵',
        accentColor: '#003087'
    }
]

export function buildCloudGames(): Game[] {
    const now = new Date().toISOString()
    return CLOUD_SERVICES.map(svc => ({
        id: svc.id,
        name: svc.name,
        platform: 'cloud' as Platform,
        description: svc.description,
        launchCommand: svc.launchCommand,
        isInstalled: true,
        addedDate: now,
        genres: ['Cloud gaming'],
        coverUrl: undefined
    }))
}
