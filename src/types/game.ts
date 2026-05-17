export interface Game {
    id: string
    name: string
    platform: Platform
    installPath?: string
    launchCommand: string
    launchArgs?: string[]
    coverUrl?: string
    customCoverUrl?: string  // User-uploaded custom cover
    backgroundUrl?: string
    screenshots?: string[]
    description?: string
    releaseDate?: string
    rating?: number
    genres?: string[]
    developer?: string
    publisher?: string
    playtime?: number
    lastPlayed?: string
    isFavorite?: boolean
    isHidden?: boolean
    isInstalled?: boolean
    collections?: string[]  // IDs of collections this game belongs to
    addedDate: string
    /** Epic / Legendary app name (for sync & install). */
    epicAppName?: string
    epicCatalogNamespace?: string
    epicCatalogItemId?: string
    /** GOG store product id (for Galaxy deep links). */
    gogProductId?: string
    gogReleaseKey?: string
}

// Custom game collection/group
export interface Collection {
    id: string
    name: string
    color: string  // Accent color for the collection
    icon: string   // Emoji icon
    createdDate: string
}

export type Platform =
    | 'steam'
    | 'epic'
    | 'ea'
    | 'ubisoft'
    | 'gog'
    | 'amazon'
    | 'xbox'
    | 'cloud'
    | 'manual'

export interface PlatformInfo {
    id: Platform
    name: string
    color: string
    icon: string
    accentColor: string
}

export const PLATFORMS: Record<Platform, PlatformInfo> = {
    steam: {
        id: 'steam',
        name: 'Steam',
        color: '#1b2838',
        icon: '🎮',
        accentColor: '#66c0f4'
    },
    epic: {
        id: 'epic',
        name: 'Epic Games',
        color: '#121212',
        icon: '🎯',
        accentColor: '#0078f2'
    },
    ea: {
        id: 'ea',
        name: 'EA App',
        color: '#1a1a1a',
        icon: '⚡',
        accentColor: '#ff4747'
    },
    ubisoft: {
        id: 'ubisoft',
        name: 'Ubisoft Connect',
        color: '#0c0c0c',
        icon: '🔷',
        accentColor: '#0070ff'
    },
    gog: {
        id: 'gog',
        name: 'GOG Galaxy',
        color: '#1c1c1c',
        icon: '🌌',
        accentColor: '#ab47bc'
    },
    amazon: {
        id: 'amazon',
        name: 'Amazon Games',
        color: '#232f3e',
        icon: '📦',
        accentColor: '#ff9900'
    },
    xbox: {
        id: 'xbox',
        name: 'Xbox / Game Pass',
        color: '#0e5a0e',
        icon: '🟢',
        accentColor: '#107c10'
    },
    cloud: {
        id: 'cloud',
        name: 'Cloud Gaming',
        color: '#1a237e',
        icon: '☁️',
        accentColor: '#5c6bc0'
    },
    manual: {
        id: 'manual',
        name: 'My Games',
        color: '#2d2d2d',
        icon: '📁',
        accentColor: '#4caf50'
    }
}

/** Safe lookup — saved user data may contain legacy or unknown platform strings. */
export function getPlatformInfo(platform: string | undefined | null): PlatformInfo {
    if (platform != null && platform in PLATFORMS) {
        return PLATFORMS[platform as Platform]
    }
    return PLATFORMS.manual
}

export interface UserData {
    games: Game[]
    collections: Collection[]
    settings: Settings
    lastScan?: string
}

import type { FullscreenControls } from './fullscreenControls'

export type ControllerLayout = 'xbox' | 'nintendo'
export type HandheldDefaultFilter = 'installed' | 'recent' | 'all'
export type UiScale = '100' | '115' | '125' | '150'
export type CloseButtonAction = 'ask' | 'tray' | 'quit'
export type WindowsPowerPlan = 'leave' | 'high' | 'balanced'
export type TdpPreset = 'eco' | 'balanced' | 'performance' | 'turbo' | 'custom'

export interface Settings {
    theme: 'dark' | 'light' | 'cyberpunk' | 'midnight' | 'oled' | 'forest'
    gridSize: 'small' | 'medium' | 'large'
    showHidden: boolean
    enableAnimations: boolean
    autoScrape: boolean
    autoStart: boolean
    steamApiKey?: string
    steamId?: string
    /** Path to legendary.exe (optional; auto-detected if empty). */
    legendaryPath?: string
    /** Path to GOG Galaxy galaxy-2.0.db (optional; auto-detected if empty). */
    gogGalaxyDbPath?: string
    language: 'en' | 'ar'
    fullscreenTheme?: 'playstation' | 'xbox' | 'nintendo'
    /** Force couch / handheld UI (fullscreen on launch, larger targets). */
    handheldMode?: boolean
    /** When true, auto-enable handheld on small screens or connected gamepad. */
    handheldAutoDetect?: boolean
    /** Start in fullscreen (Big Picture) when handheld mode is active. */
    handheldStartFullscreen?: boolean
    /** Default library tab in fullscreen handheld mode. */
    handheldDefaultFilter?: HandheldDefaultFilter
    /** Hide window to tray after launching a game. */
    minimizeOnPlay?: boolean
    /** Skip particles and heavy blur in fullscreen. */
    lowEffects?: boolean
    /** Only auto-scrape metadata while on AC power (Windows). */
    scrapeOnAcOnly?: boolean
    controllerLayout?: ControllerLayout
    /** Big Picture gamepad button bindings (customizable in Settings). */
    fullscreenControls?: FullscreenControls
    uiScale?: UiScale
    /** Keep display awake while the launcher is open (Windows). */
    preventDisplaySleep?: boolean
    /** Extra sleep block while a game is launching / launcher hidden. */
    preventSleepWhilePlaying?: boolean
    alwaysOnTop?: boolean
    rememberWindowBounds?: boolean
    closeButtonAction?: CloseButtonAction
    /** Show/hide launcher with Ctrl+Shift+G. */
    globalHotkeyEnabled?: boolean
    windowsPowerPlan?: WindowsPowerPlan
    restorePowerPlanOnExit?: boolean
    /** AMD TDP via RyzenAdj (ROG Ally, Legion Go, GPD Win, etc.). */
    tdpEnabled?: boolean
    tdpPreset?: TdpPreset
    tdpCustomWatts?: number
    ryzenAdjPath?: string
    tdpApplyOnStart?: boolean
    tdpApplyOnGameLaunch?: boolean
}

export const DEFAULT_SETTINGS: Settings = {
    theme: 'dark',
    gridSize: 'medium',
    showHidden: false,
    enableAnimations: true,
    autoScrape: true,
    autoStart: false,
    language: 'en',
    fullscreenTheme: 'xbox',
    handheldMode: false,
    handheldAutoDetect: true,
    handheldStartFullscreen: true,
    handheldDefaultFilter: 'all',
    minimizeOnPlay: true,
    lowEffects: false,
    scrapeOnAcOnly: false,
    controllerLayout: 'xbox',
    uiScale: '100',
    preventDisplaySleep: true,
    preventSleepWhilePlaying: true,
    alwaysOnTop: false,
    rememberWindowBounds: true,
    closeButtonAction: 'ask',
    globalHotkeyEnabled: true,
    windowsPowerPlan: 'leave',
    restorePowerPlanOnExit: true,
    tdpEnabled: false,
    tdpPreset: 'balanced',
    tdpCustomWatts: 15,
    ryzenAdjPath: '',
    tdpApplyOnStart: false,
    tdpApplyOnGameLaunch: true
}
