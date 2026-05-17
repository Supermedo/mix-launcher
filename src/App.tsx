import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Game, Platform, UserData, DEFAULT_SETTINGS, getPlatformInfo } from './types/game'
import { detectAllGames, launchGame, detectCloudGames } from './services/gameDetector'
import { scrapeAllGamesMetadata, clearMetadataCache } from './services/scraper'
import { fetchSteamLibrary, mergeLibraryWithInstalled } from './services/steamApi'
import { fetchEpicLibraryFromLegendary, mergeEpicLibraryWithInstalled, parseLegendaryError } from './services/epicApi'
import { fetchGogLibraryFromGalaxy, mergeGogLibraryWithInstalled, parseGogError } from './services/gogApi'
import { detectEpicGames } from './services/platforms/epic'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { GameGrid } from './components/GameGrid'
import { GameDetail } from './components/GameDetail'
import { AddGameModal } from './components/AddGameModal'
import { Settings } from './components/Settings'
import { GameContextMenu } from './components/GameContextMenu'
import { FreeGamesView } from './components/FreeGamesView'
import { FullscreenView } from './components/FullscreenView'
import { SplashScreen } from './components/SplashScreen'
import './styles/design-system.css'
import { LanguageProvider } from './context/LanguageContext'
import { shouldUseHandheldMode, uiScaleToZoom, resolveHandheldDefaultFilter } from './utils/handheld'
import { shouldMinimizeLauncherAfterLaunch } from './utils/launchBehavior'
import { applyGamingFromSettings } from './utils/gamingSettings'
import { applyTdpFromSettings } from './utils/tdpSettings'
import { buildSidebarNavIds } from './utils/sidebarNav'
import type { SidebarNavId } from './utils/sidebarNav'
import { useGamepadInput } from './hooks/useGamepadInput'
import { GamepadHintBar } from './components/GamepadHintBar'
import { LoadingOverlay } from './components/LoadingOverlay'
import { BackgroundFetchBanner, type BackgroundTaskState } from './components/BackgroundFetchBanner'
import { gamepadManager } from './services/gamepadManager'
import { markUserDataHydrated, scheduleSaveUserData, flushSaveUserData } from './utils/persistUserData'
import { showAppMessage } from './utils/showAppMessage'
import type { PowerState } from './types/electron'

/** Max covers to fetch per background run so startup stays responsive. */
const AUTO_SCRAPE_CAP = 40
const LARGE_LIBRARY_THRESHOLD = 120

interface LoadingState {
    isLoading: boolean
    message: string
    progress: number
    total: number
}

interface ContextMenuState {
    show: boolean
    game: Game | null
    position: { x: number, y: number }
}

export const App: React.FC = () => {
    const [userData, setUserData] = useState<UserData>({
        games: [],
        collections: [],
        settings: DEFAULT_SETTINGS
    })

    const [selectedPlatform, setSelectedPlatform] = useState<Platform | 'all' | 'favorites' | 'installed' | 'hidden' | string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedGame, setSelectedGame] = useState<Game | null>(null)
    const [showAddGame, setShowAddGame] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [isFullscreenMode, setIsFullscreenMode] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const [isRefreshingMetadata, setIsRefreshingMetadata] = useState(false)
    const [showSplash, setShowSplash] = useState(true)
    const [handheldActive, setHandheldActive] = useState(false)
    const [handheldReady, setHandheldReady] = useState(false)
    const [navFocus, setNavFocus] = useState<'sidebar' | 'grid'>('grid')
    const [sidebarNavIndex, setSidebarNavIndex] = useState(0)
    const [gamepadConnected, setGamepadConnected] = useState(false)

    const [contextMenu, setContextMenu] = useState<ContextMenuState>({ show: false, game: null, position: { x: 0, y: 0 } })
    const [loading, setLoading] = useState<LoadingState>({
        isLoading: true,
        message: 'Loading...',
        progress: 0,
        total: 0
    })
    const [backgroundTask, setBackgroundTask] = useState<BackgroundTaskState>({
        active: false,
        message: '',
        progress: 0,
        total: 0
    })
    const scrapeCancelRef = useRef(false)

    const sidebarNavIds = useMemo(
        () => buildSidebarNavIds(userData.collections || []),
        [userData.collections]
    )

    const modalOpen = showSettings || showAddGame || contextMenu.show
    const desktopGamepadActive = handheldActive && !isFullscreenMode && !loading.isLoading && !showSplash

    // Load saved data on mount
    useEffect(() => {
        const loadData = async () => {
            console.log('App: Starting loadData...')
            setLoading({ isLoading: true, message: 'Loading library...', progress: 0, total: 0 })

            // Check if Electron API is available
            if (!window.electronAPI) {
                console.error('Electron API not available - running in browser mode')
                setLoading({ isLoading: false, message: '', progress: 0, total: 0 })
                return
            }

            try {
                const saved = await window.electronAPI.loadUserData()
                console.log('App: Loaded saved data:', saved ? 'found' : 'none')

                const settings = saved?.settings
                    ? { ...DEFAULT_SETTINGS, ...saved.settings }
                    : DEFAULT_SETTINGS
                const handheld = shouldUseHandheldMode(settings)
                setHandheldActive(handheld)
                if (handheld && settings.handheldStartFullscreen !== false) {
                    setIsFullscreenMode(true)
                }

                if (saved && saved.games && saved.games.length > 0) {
                    const mergedSettings = { ...DEFAULT_SETTINGS, ...saved.settings }
                    setUserData({
                        ...saved,
                        settings: mergedSettings
                    })
                    if (saved.games.length > LARGE_LIBRARY_THRESHOLD) {
                        setSelectedPlatform('installed')
                    }
                    void applyGamingFromSettings(mergedSettings)
                    setLoading({ isLoading: false, message: '', progress: 0, total: 0 })
                    markUserDataHydrated()
                } else {
                    // First run - scan for games with timeout
                    console.log('App: No saved data, starting scan...')
                    await scanForGames()
                }
            } catch (error) {
                console.error('Error loading data:', error)
                setLoading({ isLoading: false, message: '', progress: 0, total: 0 })
            } finally {
                markUserDataHydrated()
                setHandheldReady(true)
            }
        }

        loadData()
        return () => flushSaveUserData()
    }, [])

    // Cloud shortcuts — defer so a large library can paint first
    useEffect(() => {
        let cancelled = false
        const timer = window.setTimeout(() => {
        detectCloudGames().then(cloudGames => {
            if (cancelled || cloudGames.length === 0) return
            setUserData(prev => {
                const saved = new Map(
                    prev.games.filter(g => g.platform === 'cloud').map(g => [g.id, g])
                )
                const mergedCloud = cloudGames.map(c => {
                    const existing = saved.get(c.id)
                    return existing
                        ? {
                            ...c,
                            isFavorite: existing.isFavorite,
                            isHidden: existing.isHidden,
                            collections: existing.collections,
                            customCoverUrl: existing.customCoverUrl,
                            lastPlayed: existing.lastPlayed,
                            addedDate: existing.addedDate
                        }
                        : c
                })
                const rest = prev.games.filter(g => g.platform !== 'cloud')
                return { ...prev, games: [...rest, ...mergedCloud] }
            })
        })
        }, 2000)
        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [])

    // Debounced save — avoids freezing the PC when metadata updates in batches
    useEffect(() => {
        scheduleSaveUserData(userData)
    }, [userData])

    // Apply theme + handheld layout class
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', userData.settings.theme || 'dark')
        const handheld = shouldUseHandheldMode(userData.settings)
        setHandheldActive(handheld)
        document.documentElement.classList.toggle('handheld-mode', handheld)
    }, [userData.settings])

    // UI zoom for Windows handheld panels
    useEffect(() => {
        if (!window.electronAPI?.setZoomFactor) return
        const zoom = uiScaleToZoom(userData.settings.uiScale)
        window.electronAPI.setZoomFactor(zoom)
    }, [userData.settings.uiScale])

    // Windows gaming: sleep blockers, power plan, hotkey, always-on-top
    useEffect(() => {
        void applyGamingFromSettings(userData.settings)
    }, [
        userData.settings.preventDisplaySleep,
        userData.settings.preventSleepWhilePlaying,
        userData.settings.alwaysOnTop,
        userData.settings.rememberWindowBounds,
        userData.settings.closeButtonAction,
        userData.settings.globalHotkeyEnabled,
        userData.settings.windowsPowerPlan,
        userData.settings.restorePowerPlanOnExit
    ])

    // Larger grid on handheld
    useEffect(() => {
        if (!handheldReady || !handheldActive) return
        if (userData.settings.gridSize === 'small') {
            setUserData(prev => ({
                ...prev,
                settings: { ...prev.settings, gridSize: 'medium' }
            }))
        }
    }, [handheldActive, handheldReady])

    useEffect(() => {
        const timer = window.setTimeout(() => {
            gamepadManager.start()
            gamepadManager.refreshDevices()
        }, 800)
        const unsub = gamepadManager.subscribeDeviceListener((devices) => {
            setGamepadConnected(devices.length > 0)
        })
        return () => {
            clearTimeout(timer)
            unsub()
        }
    }, [])

    useEffect(() => {
        const idx = sidebarNavIds.indexOf(selectedPlatform as SidebarNavId)
        if (idx >= 0) setSidebarNavIndex(idx)
    }, [selectedPlatform, sidebarNavIds])

    useGamepadInput({
        enabled: desktopGamepadActive && navFocus === 'sidebar' && !modalOpen && !selectedGame,
        layout: userData.settings.controllerLayout ?? 'xbox',
        onNavigate: (direction) => {
            if (direction === 'up') {
                setSidebarNavIndex(i => Math.max(0, i - 1))
            } else if (direction === 'down') {
                setSidebarNavIndex(i => Math.min(sidebarNavIds.length - 1, i + 1))
            }
        },
        onAction: (action) => {
            const id = sidebarNavIds[sidebarNavIndex]
            if (action === 'confirm' && id) setSelectedPlatform(id)
            if (action === 'rb') setNavFocus('grid')
            if (action === 'menu') setShowSettings(true)
        }
    })

    useGamepadInput({
        enabled: desktopGamepadActive && contextMenu.show,
        layout: userData.settings.controllerLayout ?? 'xbox',
        onAction: (action) => {
            if (action === 'back') {
                setContextMenu({ show: false, game: null, position: { x: 0, y: 0 } })
            }
        }
    })

    // Toggle Window Fullscreen
    useEffect(() => {
        if (window.electronAPI) {
            window.electronAPI.toggleFullscreen(isFullscreenMode)
        }
    }, [isFullscreenMode])

    // Filter games based on platform and search
    const filteredGames = useMemo(() => {
        let games = userData.games

        // Collection filter (selectedPlatform can be a collection ID starting with 'collection_')
        if (selectedPlatform.startsWith('collection_')) {
            games = games.filter(g => g.collections && g.collections.includes(selectedPlatform))
        }
        // Platform filter
        // Platform filter
        else if (selectedPlatform === 'favorites') {
            games = games.filter(g => g.isFavorite && !g.isHidden)
        } else if (selectedPlatform === 'installed') {
            games = games.filter(g => g.isInstalled !== false && !g.isHidden)
        } else if (selectedPlatform === 'hidden') {
            games = games.filter(g => g.isHidden)
        } else if (selectedPlatform === 'cloudgaming') {
            games = games.filter(g => g.platform === 'cloud' && !g.isHidden)
        } else if (selectedPlatform !== 'all') {
            games = games.filter(g => g.platform === selectedPlatform && !g.isHidden)
        } else {
            // All games (exclude hidden)
            games = games.filter(g => !g.isHidden)
        }

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            games = games.filter(g =>
                g.name.toLowerCase().includes(query) ||
                g.genres?.some(genre => genre.toLowerCase().includes(query)) ||
                g.developer?.toLowerCase().includes(query)
            )
        }

        // Sort by name
        return games.sort((a, b) => a.name.localeCompare(b.name))
    }, [userData.games, selectedPlatform, searchQuery])

    const mergeScrapedBatch = useCallback((batch: Game[]) => {
        const map = new Map(batch.map(g => [g.id, g]))
        setUserData(prev => ({
            ...prev,
            games: prev.games.map(g => (map.has(g.id) ? { ...g, ...map.get(g.id)! } : g))
        }))
    }, [])

    const cancelBackgroundScrape = useCallback(() => {
        scrapeCancelRef.current = true
        setBackgroundTask({ active: false, message: '', progress: 0, total: 0 })
    }, [])

    const cancelLoading = useCallback(() => {
        scrapeCancelRef.current = true
        setLoading({ isLoading: false, message: '', progress: 0, total: 0 })
        setBackgroundTask({ active: false, message: '', progress: 0, total: 0 })
    }, [])

    const fullscreenLibraryBusy = useMemo(() => {
        if (!isFullscreenMode) return undefined
        if (loading.isLoading) {
            return {
                active: true,
                message: loading.message,
                progress: loading.progress,
                total: loading.total,
                onCancel: cancelLoading
            }
        }
        if (backgroundTask.active) {
            return {
                active: true,
                message: backgroundTask.message,
                progress: backgroundTask.progress,
                total: backgroundTask.total,
                onCancel: cancelBackgroundScrape
            }
        }
        return undefined
    }, [
        isFullscreenMode,
        loading.isLoading,
        loading.message,
        loading.progress,
        loading.total,
        backgroundTask.active,
        backgroundTask.message,
        backgroundTask.progress,
        backgroundTask.total,
        cancelLoading,
        cancelBackgroundScrape
    ])

    const runBackgroundScrape = useCallback(async (gamesNeedingScrape: Game[], options?: { unlimited?: boolean }) => {
        if (gamesNeedingScrape.length === 0) return

        const cap = options?.unlimited ? gamesNeedingScrape.length : AUTO_SCRAPE_CAP
        const queue =
            gamesNeedingScrape.length > cap
                ? gamesNeedingScrape.slice(0, cap)
                : gamesNeedingScrape

        scrapeCancelRef.current = false
        setBackgroundTask({
            active: true,
            message: queue.length < gamesNeedingScrape.length
                ? `Fetching artwork (${queue.length} of ${gamesNeedingScrape.length})…`
                : '',
            progress: 0,
            total: queue.length
        })

        try {
            await scrapeAllGamesMetadata(
                queue,
                (current, total, gameName) => {
                    if (!scrapeCancelRef.current) {
                        setBackgroundTask(prev => ({
                            active: true,
                            message: prev.message.includes('Fetching artwork')
                                ? prev.message
                                : gameName,
                            progress: current,
                            total
                        }))
                    }
                },
                {
                    shouldCancel: () => scrapeCancelRef.current,
                    onBatchDone: batch => mergeScrapedBatch(batch)
                }
            )
        } catch (error) {
            console.error('Background scrape error:', error)
        } finally {
            setBackgroundTask({ active: false, message: '', progress: 0, total: 0 })
        }
    }, [mergeScrapedBatch])

    const shouldAllowAutoScrape = useCallback(async (settings: UserData['settings']) => {
        let allow = settings.autoScrape
        if (allow && settings.scrapeOnAcOnly && window.electronAPI?.getPowerState) {
            const power: PowerState = await window.electronAPI.getPowerState()
            if (power.onBattery) allow = false
        }
        return allow
    }, [])

    const handleToggleHandheld = useCallback(() => {
        setUserData(prev => {
            const on = shouldUseHandheldMode(prev.settings)
            const settings = on
                ? { ...prev.settings, handheldMode: false, handheldAutoDetect: false }
                : { ...prev.settings, handheldMode: true }
            if (!on && settings.handheldStartFullscreen !== false) {
                setIsFullscreenMode(true)
            }
            return { ...prev, settings }
        })
    }, [])

    const scanForGames = async () => {
        console.log('App: Starting scanForGames...')
        setLoading({ isLoading: true, message: 'Scanning installed games...', progress: 0, total: 0 })

        try {
            console.log('App: Calling detectAllGames...')
            const detectPromise = detectAllGames()
            const timeoutPromise = new Promise<Game[]>((_, reject) =>
                setTimeout(() => reject(new Error('Detection timeout after 60s')), 60000)
            )

            let detected: Game[]
            try {
                detected = await Promise.race([detectPromise, timeoutPromise])
            } catch (timeoutError) {
                console.error('Detection timeout:', timeoutError)
                detected = []
            }

            console.log(`App: Detection complete. Found ${detected.length} games.`)

            if (detected.length === 0) {
                console.log('App: No games detected')
                setLoading({ isLoading: false, message: '', progress: 0, total: 0 })
                return
            }

            // Merge with existing games (keep existing metadata and favorites)
            const detectedMap = new Map(detected.map(g => [g.id, g]))
            const pIds = new Set<string>()

            // 1. Update existing games
            const merged: Game[] = []

            userData.games.forEach(existing => {
                const detectedGame = detectedMap.get(existing.id)
                if (detectedGame) {
                    pIds.add(existing.id)
                    merged.push({
                        ...detectedGame,
                        ...existing, // Keep existing user preferences
                        installPath: detectedGame.installPath,
                        launchCommand: detectedGame.launchCommand,
                        isInstalled: true
                    })
                } else {
                    // Not detected in scan
                    if (existing.platform === 'manual' || existing.platform === 'cloud') {
                        merged.push(existing) // Always keep manual / cloud shortcuts
                    } else if (existing.platform === 'steam' || existing.platform === 'xbox') {
                        merged.push({ ...existing, isInstalled: false })
                    } else {
                        merged.push({ ...existing, isInstalled: false })
                    }
                }
            })

            // 2. Refresh cloud shortcuts from catalog (always up to date)
            const cloudCatalog = detected.filter(g => g.platform === 'cloud')
            const cloudIds = new Set(cloudCatalog.map(g => g.id))
            for (let i = merged.length - 1; i >= 0; i--) {
                if (merged[i].platform === 'cloud' && !cloudIds.has(merged[i].id)) {
                    merged.splice(i, 1)
                }
            }
            for (const cloudGame of cloudCatalog) {
                const idx = merged.findIndex(g => g.id === cloudGame.id)
                if (idx >= 0) {
                    merged[idx] = {
                        ...merged[idx],
                        ...cloudGame,
                        isFavorite: merged[idx].isFavorite,
                        isHidden: merged[idx].isHidden,
                        collections: merged[idx].collections,
                        customCoverUrl: merged[idx].customCoverUrl,
                        lastPlayed: merged[idx].lastPlayed
                    }
                } else {
                    merged.push(cloudGame)
                }
            }

            // 3. Add other new detected games
            detected.forEach(game => {
                if (game.platform === 'cloud') return
                if (!pIds.has(game.id)) {
                    merged.push(game)
                }
            })

            setUserData(prev => ({ ...prev, games: merged, lastScan: new Date().toISOString() }))
            setLoading({ isLoading: false, message: '', progress: 0, total: 0 })

            const gamesNeedingScrape = merged.filter(g => !g.coverUrl)
            const allowScrape = await shouldAllowAutoScrape(userData.settings)
            if (gamesNeedingScrape.length > 0 && allowScrape) {
                void runBackgroundScrape(gamesNeedingScrape)
            }
            return
        } catch (error) {
            console.error('Error scanning for games:', error)
        }

        setLoading({ isLoading: false, message: '', progress: 0, total: 0 })
    }

    const handlePlayGame = useCallback(async (game: Game) => {
        const isCloud = game.platform === 'cloud'

        try {
            const ok = await launchGame(game)
            if (!ok) {
                console.error('Launch failed for', game.name, game.launchCommand)
                const store =
                    game.platform === 'epic'
                        ? 'Epic Games Launcher'
                        : game.platform === 'gog'
                          ? 'GOG Galaxy'
                          : 'the game launcher'
                await showAppMessage(
                    `Could not open ${store} for "${game.name}". Make sure it is installed, then try again.`
                )
                return
            }
        } catch (error) {
            console.error('Launch error:', error)
            return
        }

        if (!isCloud && userData.settings.tdpEnabled && userData.settings.tdpApplyOnGameLaunch) {
            void applyTdpFromSettings(userData.settings)
        }

        if (
            !isCloud &&
            userData.settings.minimizeOnPlay !== false &&
            shouldMinimizeLauncherAfterLaunch(game) &&
            window.electronAPI?.minimize
        ) {
            window.electronAPI.minimize()
        }

        // Update last played
        setUserData(prev => ({
            ...prev,
            games: prev.games.map(g =>
                g.id === game.id
                    ? { ...g, lastPlayed: new Date().toISOString() }
                    : g
            )
        }))
    }, [userData.settings.minimizeOnPlay, userData.settings.tdpEnabled, userData.settings.tdpApplyOnGameLaunch, userData.settings])

    useEffect(() => {
        if (!handheldReady) return
        const s = userData.settings
        if (s.tdpEnabled && s.tdpApplyOnStart) {
            void applyTdpFromSettings(s)
        }
    }, [handheldReady, userData.settings.tdpEnabled, userData.settings.tdpApplyOnStart, userData.settings.tdpPreset, userData.settings.tdpCustomWatts])

    // Refresh metadata for all games (force re-scrape)
    const handleRefreshMetadata = useCallback(async () => {
        if (isRefreshingMetadata || backgroundTask.active) return

        setIsRefreshingMetadata(true)
        clearMetadataCache()
        scrapeCancelRef.current = false
        setBackgroundTask({ active: true, message: '', progress: 0, total: userData.games.length })

        try {
            await scrapeAllGamesMetadata(
                userData.games,
                (current, total, gameName) => {
                    if (!scrapeCancelRef.current) {
                        setBackgroundTask({
                            active: true,
                            message: gameName,
                            progress: current,
                            total
                        })
                    }
                },
                {
                    shouldCancel: () => scrapeCancelRef.current,
                    onBatchDone: batch => mergeScrapedBatch(batch)
                }
            )
        } catch (error) {
            console.error('Error refreshing metadata:', error)
        } finally {
            setIsRefreshingMetadata(false)
            setBackgroundTask({ active: false, message: '', progress: 0, total: 0 })
        }
    }, [userData.games, isRefreshingMetadata, backgroundTask.active, mergeScrapedBatch])

    const handleToggleFavorite = useCallback((game: Game) => {
        setUserData(prev => ({
            ...prev,
            games: prev.games.map(g =>
                g.id === game.id
                    ? { ...g, isFavorite: !g.isFavorite }
                    : g
            )
        }))

        // Update selected game if it's the one being modified
        if (selectedGame?.id === game.id) {
            setSelectedGame(prev => prev ? { ...prev, isFavorite: !prev.isFavorite } : null)
        }
    }, [selectedGame])

    const handleAddGame = useCallback((game: Game) => {
        setUserData(prev => ({
            ...prev,
            games: [...prev.games, game]
        }))
    }, [])

    const syncSteamLibrary = useCallback(async () => {
        const { steamId } = userData.settings
        if (!steamId) {
            console.log('Steam ID not configured')
            return
        }

        setIsSyncing(true)
        setLoading({ isLoading: true, message: 'Syncing Steam library...', progress: 0, total: 0 })

        try {
            // Fetch cloud library (uses embedded API key)
            const cloudGames = await fetchSteamLibrary(steamId)
            console.log(`Fetched ${cloudGames.length} games from Steam`)

            // Get locally installed Steam games
            const localGames = userData.games.filter(g => g.platform === 'steam' && g.isInstalled !== false)

            // Merge cloud with local
            const merged = mergeLibraryWithInstalled(cloudGames, localGames)

            // Keep non-Steam games
            const nonSteamGames = userData.games.filter(g => g.platform !== 'steam')

            // First update with merged games (Steam CDN URLs)
            const allGames = [...nonSteamGames, ...merged]
            setUserData(prev => ({
                ...prev,
                games: allGames
            }))

            console.log(`Steam library synced: ${merged.length} games`)

            setLoading({ isLoading: false, message: '', progress: 0, total: 0 })

            const allowScrape = await shouldAllowAutoScrape(userData.settings)
            const needingScrape = merged.filter(g => !g.coverUrl)
            if (allowScrape && needingScrape.length > 0) {
                void runBackgroundScrape(needingScrape)
            }
        } catch (error) {
            console.error('Error syncing Steam library:', error)
        }

        setIsSyncing(false)
        setLoading({ isLoading: false, message: '', progress: 0, total: 0 })
    }, [userData.settings, userData.games, shouldAllowAutoScrape, runBackgroundScrape])

    const syncEpicLibrary = useCallback(async () => {
        if (!window.electronAPI?.legendaryFetchLibrary) {
            console.error('Legendary API not available')
            return
        }

        setIsSyncing(true)
        setLoading({ isLoading: true, message: 'Syncing Epic library via Legendary...', progress: 0, total: 0 })

        try {
            const cloudGames = await fetchEpicLibraryFromLegendary(userData.settings.legendaryPath)
            console.log(`Fetched ${cloudGames.length} games from Epic (Legendary)`)

            const localEpic = await detectEpicGames()
            const merged = mergeEpicLibraryWithInstalled(cloudGames, localEpic)
            const nonEpic = userData.games.filter(g => g.platform !== 'epic')

            setUserData(prev => ({
                ...prev,
                games: [...nonEpic, ...merged]
            }))

            console.log(`Epic library synced: ${merged.length} games`)

            setLoading({ isLoading: false, message: '', progress: 0, total: 0 })

            const allowScrape = await shouldAllowAutoScrape(userData.settings)
            const needingScrape = merged.filter(g => !g.coverUrl)
            if (allowScrape && needingScrape.length > 0) {
                void runBackgroundScrape(needingScrape)
            }
        } catch (error) {
            console.error('Error syncing Epic library:', error)
            void showAppMessage(parseLegendaryError(error))
        }

        setIsSyncing(false)
        setLoading({ isLoading: false, message: '', progress: 0, total: 0 })
    }, [userData.settings, userData.games, shouldAllowAutoScrape, runBackgroundScrape])

    const syncGogLibrary = useCallback(async () => {
        if (!window.electronAPI?.gogFetchLibrary) {
            console.error('GOG API not available')
            return
        }

        setIsSyncing(true)
        setLoading({ isLoading: true, message: 'Syncing GOG library from GOG Galaxy...', progress: 0, total: 0 })

        try {
            const cloudGames = await fetchGogLibraryFromGalaxy(userData.settings.gogGalaxyDbPath)
            console.log(`Fetched ${cloudGames.length} games from GOG Galaxy`)

            const { detectGOGGames } = await import('./services/platforms/gog')
            const localGog = await detectGOGGames()
            const merged = mergeGogLibraryWithInstalled(cloudGames, localGog)
            const nonGog = userData.games.filter(g => g.platform !== 'gog')

            setUserData(prev => ({
                ...prev,
                games: [...nonGog, ...merged]
            }))

            console.log(`GOG library synced: ${merged.length} games`)
            setLoading({ isLoading: false, message: '', progress: 0, total: 0 })

            const allowScrape = await shouldAllowAutoScrape(userData.settings)
            const needingScrape = merged.filter(g => !g.coverUrl)
            if (allowScrape && needingScrape.length > 0) {
                void runBackgroundScrape(needingScrape)
            }
        } catch (error) {
            console.error('Error syncing GOG library:', error)
            void showAppMessage(parseGogError(error))
        }

        setIsSyncing(false)
        setLoading({ isLoading: false, message: '', progress: 0, total: 0 })
    }, [userData.settings, userData.games, shouldAllowAutoScrape, runBackgroundScrape])

    // Window controls
    const handleMinimize = () => window.electronAPI.minimize()
    const handleMaximize = () => window.electronAPI.maximize()
    const handleClose = () => window.electronAPI.close()

    return (
        <LanguageProvider initialLanguage={userData.settings.language || 'en'}>
            {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
            
            <div className={`app-container ${handheldActive ? 'handheld-active' : ''}${isFullscreenMode ? ' app-fullscreen-mode' : ''}`}>
                {isFullscreenMode && (
                    <FullscreenView
                        games={userData.games.filter(g => !g.isHidden)}
                        onPlay={handlePlayGame}
                        onClose={() => setIsFullscreenMode(false)}
                        onRefreshMetadata={handleRefreshMetadata}
                        isRefreshing={isRefreshingMetadata}
                        defaultFilter={resolveHandheldDefaultFilter(userData.settings)}
                        fullscreenTheme={userData.settings.fullscreenTheme ?? 'xbox'}
                        controllerLayout={userData.settings.controllerLayout ?? 'xbox'}
                        lowEffects={userData.settings.lowEffects ?? false}
                        onOpenSettings={() => setShowSettings(true)}
                        onAddGame={() => setShowAddGame(true)}
                        onScanGames={scanForGames}
                        libraryBusy={fullscreenLibraryBusy}
                        fullscreenControls={userData.settings.fullscreenControls}
                        inputBlocked={showSettings || showAddGame}
                    />
                )}

                {!isFullscreenMode && (
                    <TitleBar
                        onMinimize={handleMinimize}
                        onMaximize={handleMaximize}
                        onClose={handleClose}
                    />
                )}

                {!isFullscreenMode && <LoadingOverlay loading={loading} onBack={cancelLoading} />}
                {!isFullscreenMode && (
                    <BackgroundFetchBanner task={backgroundTask} onSkip={cancelBackgroundScrape} />
                )}

                {!loading.isLoading && !isFullscreenMode && (
                    <>
                        <div className="main-content">
                            <Sidebar
                                games={userData.games}
                                collections={userData.collections || []}
                                selectedPlatform={selectedPlatform}
                                searchQuery={searchQuery}
                                onPlatformChange={setSelectedPlatform}
                                onSearchChange={setSearchQuery}
                                onAddGame={() => setShowAddGame(true)}
                                onScanGames={scanForGames}
                                onSettings={() => setShowSettings(true)}
                                onToggleFullscreen={() => setIsFullscreenMode(true)}
                                handheldActive={handheldActive}
                                onToggleHandheld={handleToggleHandheld}
                                controllerFocusId={sidebarNavIds[sidebarNavIndex] ?? 'all'}
                                controllerNavActive={desktopGamepadActive && navFocus === 'sidebar'}
                            />

                            <div className="content-area">
                                {selectedPlatform === 'freegames' ? (
                                    <FreeGamesView
                                        onOpenUrl={(url) => window.electronAPI.openExternal(url)}
                                        gamepadEnabled={desktopGamepadActive && !modalOpen}
                                        controllerLayout={userData.settings.controllerLayout}
                                        onBack={() => setSelectedPlatform('all')}
                                    />
                                ) : (
                                    <>
                                        <div className="content-header">
                                            <h1 className="content-title">
                                                {selectedPlatform === 'all' && 'All Games'}
                                                {selectedPlatform === 'favorites' && 'Favorites'}
                                                {selectedPlatform === 'installed' && 'Installed Games'}
                                                {selectedPlatform === 'hidden' && 'Hidden Games'}
                                                {selectedPlatform === 'cloudgaming' && 'Cloud Gaming'}
                                                {selectedPlatform.startsWith('collection_') &&
                                                    (userData.collections?.find(c => c.id === selectedPlatform)?.name || 'Collection')}
                                                {selectedPlatform !== 'all' &&
                                                    selectedPlatform !== 'favorites' &&
                                                    selectedPlatform !== 'installed' &&
                                                    selectedPlatform !== 'hidden' &&
                                                    selectedPlatform !== 'freegames' &&
                                                    selectedPlatform !== 'cloudgaming' &&
                                                    !selectedPlatform.startsWith('collection_') &&
                                                    `${getPlatformInfo(selectedPlatform).name} Games`}
                                            </h1>

                                            {/* ... rest of header ... */}
                                            <div className="content-actions">
                                                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                                                    {filteredGames.length} game{filteredGames.length !== 1 ? 's' : ''}
                                                </span>

                                                <div className="view-toggle">
                                                    <button
                                                        className={`view-toggle-btn ${userData.settings.gridSize === 'small' ? 'active' : ''}`}
                                                        onClick={() => setUserData(prev => ({
                                                            ...prev,
                                                            settings: { ...prev.settings, gridSize: 'small' }
                                                        }))}
                                                        title="Small grid"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                                            <rect x="1" y="1" width="6" height="6" rx="1" />
                                                            <rect x="9" y="1" width="6" height="6" rx="1" />
                                                            <rect x="1" y="9" width="6" height="6" rx="1" />
                                                            <rect x="9" y="9" width="6" height="6" rx="1" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        className={`view-toggle-btn ${userData.settings.gridSize === 'medium' ? 'active' : ''}`}
                                                        onClick={() => setUserData(prev => ({
                                                            ...prev,
                                                            settings: { ...prev.settings, gridSize: 'medium' }
                                                        }))}
                                                        title="Medium grid"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                                            <rect x="1" y="1" width="6" height="14" rx="1" />
                                                            <rect x="9" y="1" width="6" height="14" rx="1" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        className={`view-toggle-btn ${userData.settings.gridSize === 'large' ? 'active' : ''}`}
                                                        onClick={() => setUserData(prev => ({
                                                            ...prev,
                                                            settings: { ...prev.settings, gridSize: 'large' }
                                                        }))}
                                                        title="Large grid"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                                            <rect x="1" y="1" width="14" height="14" rx="1" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <GameGrid
                                            games={filteredGames}
                                            gridSize={userData.settings.gridSize}
                                            controllerLayout={userData.settings.controllerLayout}
                                            gamepadEnabled={desktopGamepadActive && navFocus === 'grid' && !modalOpen && !selectedGame}
                                            touchToPlay={handheldActive}
                                            onFocusSidebar={() => setNavFocus('sidebar')}
                                            onSelectGame={setSelectedGame}
                                            onPlayGame={handlePlayGame}
                                            onToggleFavorite={handleToggleFavorite}
                                            onContextMenu={(game, position) => setContextMenu({ show: true, game, position })}
                                        />
                                    </>
                                )}
                            </div>
                        </div>

                        {selectedGame && (
                            <GameDetail
                                game={selectedGame}
                                onClose={() => setSelectedGame(null)}
                                onToggleFavorite={handleToggleFavorite}
                                onPlay={handlePlayGame}
                                controllerLayout={userData.settings.controllerLayout}
                            />
                        )}

                        <GamepadHintBar
                            layout={userData.settings.controllerLayout ?? 'xbox'}
                            visible={desktopGamepadActive && gamepadConnected && !modalOpen && !selectedGame}
                            focusArea={navFocus}
                            touchHint={handheldActive}
                        />

                        {contextMenu.show && contextMenu.game && (
                            <GameContextMenu
                                game={userData.games.find(g => g.id === contextMenu.game!.id) || contextMenu.game}
                                collections={userData.collections}
                                position={contextMenu.position}
                                onClose={() => setContextMenu({ show: false, game: null, position: { x: 0, y: 0 } })}
                                onHide={(game) => {
                                    setUserData(prev => ({
                                        ...prev,
                                        games: prev.games.map(g => g.id === game.id ? { ...g, isHidden: true } : g)
                                    }))
                                    setContextMenu({ show: false, game: null, position: { x: 0, y: 0 } })
                                }}
                                onUnhide={(game) => {
                                    setUserData(prev => ({
                                        ...prev,
                                        games: prev.games.map(g => g.id === game.id ? { ...g, isHidden: false } : g)
                                    }))
                                    setContextMenu({ show: false, game: null, position: { x: 0, y: 0 } })
                                }}
                                onAddToCollection={(game, collectionId) => {
                                    setUserData(prev => ({
                                        ...prev,
                                        games: prev.games.map(g => {
                                            if (g.id === game.id) {
                                                const collections = g.collections || []
                                                return { ...g, collections: [...collections, collectionId] }
                                            }
                                            return g
                                        })
                                    }))
                                }}
                                onRemoveFromCollection={(game, collectionId) => {
                                    setUserData(prev => ({
                                        ...prev,
                                        games: prev.games.map(g => {
                                            if (g.id === game.id) {
                                                const collections = g.collections || []
                                                return { ...g, collections: (collections).filter(c => c !== collectionId) }
                                            }
                                            return g
                                        })
                                    }))
                                }}
                                onSetCustomCover={async (game) => {
                                    setContextMenu({ show: false, game: null, position: { x: 0, y: 0 } })
                                    const result = await window.electronAPI.openFileDialog()
                                    if (result) {
                                        setUserData(prev => ({
                                            ...prev,
                                            games: prev.games.map(g => g.id === game.id ? { ...g, customCoverUrl: result } : g)
                                        }))
                                    }
                                }}
                                onRemoveCustomCover={(game) => {
                                    setUserData(prev => ({
                                        ...prev,
                                        games: prev.games.map(g => g.id === game.id ? { ...g, customCoverUrl: undefined } : g)
                                    }))
                                    setContextMenu({ show: false, game: null, position: { x: 0, y: 0 } })
                                }}
                            />
                        )}
                    </>
                )}

                {showAddGame && (
                    <AddGameModal
                        onClose={() => setShowAddGame(false)}
                        onGameAdded={handleAddGame}
                    />
                )}

                {showSettings && (
                    <Settings
                                settings={userData.settings}
                                onSave={(newSettings) => {
                                    void applyGamingFromSettings(newSettings)
                                    setUserData(prev => ({ ...prev, settings: newSettings }))
                                    setShowSettings(false)
                                }}
                                onClose={() => setShowSettings(false)}
                                onSyncSteam={syncSteamLibrary}
                                onSyncEpic={syncEpicLibrary}
                                onSyncGog={syncGogLibrary}
                                isSyncing={isSyncing}
                                collections={userData.collections}
                                onAddCollection={(collection) => {
                                    setUserData(prev => ({
                                        ...prev,
                                        collections: [...(prev.collections || []), collection]
                                    }))
                                }}
                                onDeleteCollection={(collectionId) => {
                                    setUserData(prev => ({
                                        ...prev,
                                        collections: (prev.collections || []).filter(c => c.id !== collectionId),
                                        // Also remove this collection from all games
                                        games: prev.games.map(g => ({
                                            ...g,
                                            collections: (g.collections || []).filter(c => c !== collectionId)
                                        }))
                                    }))
                                }}
                                onImportData={(data) => {
                                    setUserData(data);
                                    setShowSettings(false);
                                }}
                                fullUserData={userData}
                    />
                )}
            </div>
        </LanguageProvider>
    )
}

export default App
