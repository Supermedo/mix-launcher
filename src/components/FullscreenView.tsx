import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Game, Platform, PLATFORMS, getPlatformInfo, HandheldDefaultFilter, ControllerLayout } from '../types/game'
import { buildFullscreenNavItems, isFullscreenLibraryFilter, type FullscreenFilterId } from '../utils/fullscreenNav'
import { PlatformIcon } from './PlatformIcon'
import {
    detectGamepadProfile,
    readNavigation,
    readNavigationGeneric
} from '../input/gamepadProfiles'
import type { FullscreenControlAction, FullscreenControls } from '../types/fullscreenControls'
import {
    getConfirmBackIndicesFromControls,
    mergeFullscreenControls,
    resolveFullscreenAction
} from '../utils/fullscreenControls'
import { getActiveGamepadFromScan, gamepadManager } from '../services/gamepadManager'
import type { PowerState } from '../types/electron'
import { getGameGalleryImages } from '../utils/gameGallery'
import { useLanguage } from '../context/LanguageContext'
import {
    FsBatteryIcon,
    FsCheckIcon,
    FsControllerIcon,
    FsEmptyIcon,
    FsGamepadIcon,
    FsHeartIcon,
    FsNavFilterIcon,
    FsQuickMenuIcon,
    FsStarIcon,
    type QuickMenuAction
} from './FullscreenIcons'
import { APP_NAME } from '../constants/app'
import './FullscreenView.css'

interface FullscreenViewProps {
    games: Game[]
    onPlay: (game: Game) => void
    onClose: () => void
    onRefreshMetadata?: () => void
    isRefreshing?: boolean
    defaultFilter?: HandheldDefaultFilter
    fullscreenTheme?: 'playstation' | 'xbox' | 'nintendo'
    controllerLayout?: ControllerLayout
    lowEffects?: boolean
    onOpenSettings?: () => void
    onAddGame?: () => void
    fullscreenControls?: FullscreenControls
    /** When true, gamepad/keyboard do not control Big Picture (modal open on top). */
    inputBlocked?: boolean
    onScanGames?: () => void
    libraryBusy?: {
        active: boolean
        message: string
        progress: number
        total: number
        onCancel?: () => void
    }
}

interface QuickMenuItem {
    action: QuickMenuAction
    label: string
}

type FilterType = FullscreenFilterId

export const FullscreenView: React.FC<FullscreenViewProps> = ({
    games,
    onPlay,
    onClose,
    onRefreshMetadata,
    isRefreshing,
    defaultFilter = 'installed',
    fullscreenTheme = 'xbox',
    controllerLayout = 'xbox',
    lowEffects = false,
    onOpenSettings,
    onAddGame,
    fullscreenControls: fullscreenControlsProp,
    inputBlocked = false,
    onScanGames,
    libraryBusy
}) => {
    const { t } = useLanguage()

    const primaryActionLabel = (game: Game) => {
        if (game.isInstalled !== true) {
            if (game.platform === 'steam' || game.platform === 'epic' || game.platform === 'gog') {
                return t('game.install')
            }
        }
        return t('game.playNow')
    }

    const controls = useMemo(
        () => mergeFullscreenControls(fullscreenControlsProp),
        [fullscreenControlsProp]
    )
    const initialFilter: FilterType = defaultFilter === 'recent' ? 'recent' : defaultFilter
    const [selectedGameIndex, setSelectedGameIndex] = useState(0)
    const [selectedNavIndex, setSelectedNavIndex] = useState(0)
    const [activeFilter, setActiveFilter] = useState<FilterType>(initialFilter)
    const [powerState, setPowerState] = useState<PowerState | null>(null)
    const [focusArea, setFocusArea] = useState<'nav' | 'games'>('games')
    const [isTransitioning, setIsTransitioning] = useState(false)
    const [showQuickMenu, setShowQuickMenu] = useState(false)
    const [showExitConfirm, setShowExitConfirm] = useState(false)
    const [overlayMenuIndex, setOverlayMenuIndex] = useState(0)
    const [exitFocusIndex, setExitFocusIndex] = useState(0)
    const overlayMenuRef = useRef<HTMLDivElement>(null)
    const [viewMode, setViewMode] = useState<'horizontal' | 'vertical'>('horizontal')
    const [activeScreenshot, setActiveScreenshot] = useState(0)
    const [time, setTime] = useState(new Date())
    const [particles, setParticles] = useState<{ id: number; x: number; y: number; size: number; speed: number; opacity: number }[]>([])
    const [controllerConnected, setControllerConnected] = useState(false)
    
    // Refs
    const containerRef = useRef<HTMLDivElement>(null)
    const headerRef = useRef<HTMLElement>(null)
    const footerRef = useRef<HTMLElement>(null)
    const gameListRef = useRef<HTMLDivElement>(null)
    const navRef = useRef<HTMLElement>(null)
    const touchStartX = useRef(0)
    const lastInputTime = useRef(0)
    const gamepadPollRef = useRef<number>()
    const prevButtonsRef = useRef<boolean[]>([])

    // Filter games
    const filteredGames = useMemo(() => {
        let result = games.filter(g => !g.isHidden)

        switch (activeFilter) {
            case 'installed':
                result = result.filter(g => g.isInstalled !== false)
                    .sort((a, b) => a.name.localeCompare(b.name))
                break
            case 'favorites':
                result = result.filter(g => g.isFavorite)
                break
            case 'recent':
                result = result
                    .filter(g => g.lastPlayed)
                    .sort((a, b) => new Date(b.lastPlayed!).getTime() - new Date(a.lastPlayed!).getTime())
                break
            case 'all':
                result = result.sort((a, b) => a.name.localeCompare(b.name))
                break
            default:
                result = result.filter(g => g.platform === activeFilter)
                    .sort((a, b) => a.name.localeCompare(b.name))
        }

        return result
    }, [games, activeFilter])

    const selectedGame = filteredGames[selectedGameIndex] || null
    const galleryImages = useMemo(() => getGameGalleryImages(selectedGame), [selectedGame])

    const navItems = useMemo(() => buildFullscreenNavItems(), [])
    const libraryNavItems = useMemo(
        () => navItems.filter(item => isFullscreenLibraryFilter(item.id)),
        [navItems]
    )
    const platformNavItems = useMemo(
        () => navItems.filter(item => !isFullscreenLibraryFilter(item.id)),
        [navItems]
    )

    useEffect(() => {
        if (!window.electronAPI?.getPowerState) return
        window.electronAPI.getPowerState().then(setPowerState)
        const unsub = window.electronAPI.onPowerState?.(setPowerState)
        return () => unsub?.()
    }, [])

    useEffect(() => {
        const root = containerRef.current
        if (!root) return

        const syncChrome = () => {
            const top = headerRef.current?.offsetHeight ?? 132
            const bottom = footerRef.current?.offsetHeight ?? 72
            root.style.setProperty('--fs-chrome-top', `${top}px`)
            root.style.setProperty('--fs-chrome-bottom', `${bottom}px`)
        }

        syncChrome()
        const observer = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(syncChrome)
            : null
        if (headerRef.current) observer?.observe(headerRef.current)
        if (footerRef.current) observer?.observe(footerRef.current)
        window.addEventListener('resize', syncChrome)
        return () => {
            observer?.disconnect()
            window.removeEventListener('resize', syncChrome)
        }
    }, [viewMode, navItems.length])

    // Initialize particles for ambient effect
    useEffect(() => {
        if (lowEffects) {
            setParticles([])
            return
        }
        const newParticles = Array.from({ length: 50 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: Math.random() * 3 + 1,
            speed: Math.random() * 0.5 + 0.1,
            opacity: Math.random() * 0.5 + 0.1
        }))
        setParticles(newParticles)
    }, [lowEffects])

    // Update clock
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    // Reset selection when filter changes
    useEffect(() => {
        setSelectedGameIndex(0)
        setActiveScreenshot(0)
        setIsTransitioning(true)
        setTimeout(() => setIsTransitioning(false), 300)
    }, [activeFilter])

    // Reset screenshot when game changes
    useEffect(() => {
        setActiveScreenshot(0)
    }, [selectedGameIndex])

    // Auto-cycle gallery
    useEffect(() => {
        if (galleryImages.length <= 1) return

        const timer = setInterval(() => {
            setActiveScreenshot(prev => (prev + 1) % galleryImages.length)
        }, 4000)

        return () => clearInterval(timer)
    }, [galleryImages])

    useEffect(() => {
        if (activeScreenshot >= galleryImages.length && galleryImages.length > 0) {
            setActiveScreenshot(0)
        }
    }, [galleryImages.length, activeScreenshot])

    // Scroll selected game into view
    useEffect(() => {
        if (gameListRef.current && focusArea === 'games') {
            const container = gameListRef.current
            const cards = container.querySelectorAll('.fs-game-card')
            const selectedCard = cards[selectedGameIndex] as HTMLElement
            
            if (selectedCard) {
                const containerRect = container.getBoundingClientRect()
                const cardRect = selectedCard.getBoundingClientRect()
                const scrollLeft = selectedCard.offsetLeft - (containerRect.width / 2) + (cardRect.width / 2)
                
                container.scrollTo({
                    left: scrollLeft,
                    behavior: 'smooth'
                })
            }
        }
    }, [selectedGameIndex, focusArea])

    useEffect(() => {
        if (focusArea !== 'nav' || !navRef.current) return
        const buttons = navRef.current.querySelectorAll<HTMLButtonElement>('.fs-nav-item')
        buttons[selectedNavIndex]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
    }, [selectedNavIndex, focusArea])

    // Input handling with debounce
    const handleInput = useCallback(() => {
        const now = Date.now()
        if (now - lastInputTime.current < 150) return false
        lastInputTime.current = now
        return true
    }, [])

    // Navigation functions
    const navigateGames = useCallback((direction: 'left' | 'right') => {
        if (!handleInput()) return
        
        setSelectedGameIndex(prev => {
            if (direction === 'left') {
                return prev > 0 ? prev - 1 : filteredGames.length - 1
            } else {
                return prev < filteredGames.length - 1 ? prev + 1 : 0
            }
        })
    }, [filteredGames.length, handleInput])

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartX.current = e.touches[0]?.clientX ?? 0
    }, [])

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        const endX = e.changedTouches[0]?.clientX ?? 0
        const dx = endX - touchStartX.current
        if (Math.abs(dx) < 48) return
        navigateGames(dx < 0 ? 'right' : 'left')
    }, [navigateGames])

    const navigateNav = useCallback((direction: 'left' | 'right') => {
        if (!handleInput()) return

        setSelectedNavIndex(prev => {
            const newIndex = direction === 'left'
                ? (prev > 0 ? prev - 1 : navItems.length - 1)
                : (prev < navItems.length - 1 ? prev + 1 : 0)

            const item = navItems[newIndex]
            if (item) {
                setActiveFilter(item.id)
                setSelectedGameIndex(0)
            }

            return newIndex
        })
    }, [navItems, handleInput])

    const selectNavItem = useCallback(() => {
        const item = navItems[selectedNavIndex]
        if (item) {
            setActiveFilter(item.id)
            setFocusArea('games')
        }
    }, [selectedNavIndex, navItems])

    const requestClose = useCallback(() => {
        setShowExitConfirm(true)
    }, [])

    const confirmExit = useCallback(() => {
        setShowExitConfirm(false)
        onClose()
    }, [onClose])

    const cancelExit = useCallback(() => {
        setShowExitConfirm(false)
    }, [])

    const toggleViewMode = useCallback(() => {
        setViewMode(prev => (prev === 'horizontal' ? 'vertical' : 'horizontal'))
    }, [])

    const quickMenuItems = useMemo((): QuickMenuItem[] => {
        const items: QuickMenuItem[] = [
            {
                action: 'toggleView',
                label: viewMode === 'horizontal' ? t('fullscreen.viewConsole') : t('fullscreen.viewCarousel')
            }
        ]
        if (onScanGames) {
            items.push({ action: 'scanGames', label: t('sidebar.scan') })
        }
        if (onAddGame) {
            items.push({ action: 'addGame', label: t('fullscreen.addGame') })
        }
        if (onOpenSettings) {
            items.push({ action: 'settings', label: t('fullscreen.settings') })
        }
        items.push(
            { action: 'exit', label: t('fullscreen.exitFullscreen') },
            { action: 'close', label: t('fullscreen.closeMenu') }
        )
        return items
    }, [viewMode, onScanGames, onAddGame, onOpenSettings, t])

    const openQuickMenu = useCallback(() => {
        setOverlayMenuIndex(0)
        setShowQuickMenu(true)
    }, [])

    const activateQuickMenuItem = useCallback((index: number) => {
        const item = quickMenuItems[index]
        if (!item) return
        setShowQuickMenu(false)
        switch (item.action) {
            case 'toggleView':
                toggleViewMode()
                break
            case 'scanGames':
                onScanGames?.()
                break
            case 'addGame':
                onAddGame?.()
                break
            case 'settings':
                onOpenSettings?.()
                break
            case 'exit':
                requestClose()
                break
            case 'close':
                break
        }
    }, [quickMenuItems, toggleViewMode, onScanGames, onAddGame, onOpenSettings, requestClose])

    const runControlAction = useCallback((action: FullscreenControlAction) => {
        switch (action) {
            case 'play':
                if (selectedGame) onPlay(selectedGame)
                break
            case 'back':
                requestClose()
                break
            case 'toggleView':
                toggleViewMode()
                break
            case 'quickMenu':
                openQuickMenu()
                break
            case 'settings':
                onOpenSettings?.()
                break
            case 'addGame':
                onAddGame?.()
                break
            case 'prevTab':
                navigateNav('left')
                break
            case 'nextTab':
                navigateNav('right')
                break
            case 'prevGame':
                navigateGames('left')
                break
            case 'nextGame':
                navigateGames('right')
                break
        }
    }, [
        selectedGame,
        onPlay,
        requestClose,
        toggleViewMode,
        openQuickMenu,
        onOpenSettings,
        onAddGame,
        navigateNav,
        navigateGames
    ])

    useEffect(() => {
        if (showQuickMenu) setOverlayMenuIndex(0)
    }, [showQuickMenu])

    useEffect(() => {
        if (showExitConfirm) setExitFocusIndex(0)
    }, [showExitConfirm])

    useEffect(() => {
        if (!showQuickMenu || !overlayMenuRef.current) return
        const buttons = overlayMenuRef.current.querySelectorAll<HTMLButtonElement>('.fs-quick-item')
        buttons[overlayMenuIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, [overlayMenuIndex, showQuickMenu])

    // Gamepad polling with debounce
    useEffect(() => {
        let lastStickNav = 0
        const STICK_DELAY = 200
        
        gamepadManager.start()

        const pollGamepad = () => {
            if (inputBlocked) {
                prevButtonsRef.current = []
                gamepadPollRef.current = requestAnimationFrame(pollGamepad)
                return
            }

            const gamepad = getActiveGamepadFromScan()

            if (gamepad) {
                setControllerConnected(true)
                const profile = detectGamepadProfile(gamepad)
                const buttons = Array.from(gamepad.buttons).map(b => b.pressed || b.value > 0.55)
                const axes = gamepad.axes
                const prevButtons = prevButtonsRef.current
                const now = Date.now()
                const threshold = 0.5

                const isNewPress = (index: number) => buttons[index] && !prevButtons[index]

                const stickNav = (axis: number, positive: boolean): boolean => {
                    const value = axes[axis]
                    const triggered = positive ? value > threshold : value < -threshold
                    if (triggered && now - lastStickNav > STICK_DELAY) {
                        lastStickNav = now
                        return true
                    }
                    return false
                }

                const { confirm, back } = getConfirmBackIndicesFromControls(controls, controllerLayout, profile)
                const nav =
                    gamepad.mapping === 'standard' || profile === 'xbox'
                        ? readNavigation(buttons, axes, threshold)
                        : readNavigationGeneric(buttons, axes, profile, threshold)

                const overlayStep = (delta: number, max: number, current: number) =>
                    Math.max(0, Math.min(max, current + delta))

                if (showExitConfirm) {
                    if (nav === 'left' || nav === 'up' || stickNav(0, false) || stickNav(1, false)) {
                        setExitFocusIndex(0)
                    }
                    if (nav === 'right' || nav === 'down' || stickNav(0, true) || stickNav(1, true)) {
                        setExitFocusIndex(1)
                    }
                    if (isNewPress(back)) cancelExit()
                    if (isNewPress(confirm)) {
                        if (exitFocusIndex === 0) cancelExit()
                        else confirmExit()
                    }
                } else if (showQuickMenu) {
                    const max = quickMenuItems.length - 1
                    if (nav === 'up' || stickNav(1, false)) {
                        setOverlayMenuIndex(i => overlayStep(-1, max, i))
                    }
                    if (nav === 'down' || stickNav(1, true)) {
                        setOverlayMenuIndex(i => overlayStep(1, max, i))
                    }
                    if (isNewPress(back)) setShowQuickMenu(false)
                    if (isNewPress(confirm)) activateQuickMenuItem(overlayMenuIndex)
                } else {
                    if (nav === 'left' || stickNav(0, false)) navigateGames('left')
                    if (nav === 'right' || stickNav(0, true)) navigateGames('right')
                    if (nav === 'up' || stickNav(1, false)) navigateNav('left')
                    if (nav === 'down' || stickNav(1, true)) navigateNav('right')

                    for (let i = 0; i < buttons.length; i++) {
                        if (!isNewPress(i)) continue
                        const action = resolveFullscreenAction(i, controls, controllerLayout, profile)
                        if (action) runControlAction(action)
                    }
                }

                prevButtonsRef.current = buttons
            } else {
                setControllerConnected(false)
            }

            gamepadPollRef.current = requestAnimationFrame(pollGamepad)
        }

        const unsubDevices = gamepadManager.subscribeDeviceListener((devices) => {
            setControllerConnected(devices.length > 0)
        })

        gamepadPollRef.current = requestAnimationFrame(pollGamepad)

        return () => {
            if (gamepadPollRef.current) cancelAnimationFrame(gamepadPollRef.current)
            unsubDevices()
        }
    }, [
        showQuickMenu,
        showExitConfirm,
        overlayMenuIndex,
        exitFocusIndex,
        quickMenuItems,
        controls,
        selectedGame,
        navigateGames,
        navigateNav,
        runControlAction,
        activateQuickMenuItem,
        requestClose,
        confirmExit,
        cancelExit,
        controllerLayout,
        inputBlocked
    ])

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (inputBlocked) return

            // Prevent default for navigation keys
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Escape', ' ', 'Tab'].includes(e.key)) {
                e.preventDefault()
            }

            if (showExitConfirm) {
                if (e.key === 'Escape' || e.key === 'Backspace') cancelExit()
                else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setExitFocusIndex(0)
                else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setExitFocusIndex(1)
                else if (e.key === 'Enter') {
                    if (exitFocusIndex === 0) cancelExit()
                    else confirmExit()
                }
                return
            }

            if (showQuickMenu) {
                if (e.key === 'Escape' || e.key === 'Backspace') setShowQuickMenu(false)
                else if (e.key === 'ArrowUp') {
                    setOverlayMenuIndex(i => Math.max(0, i - 1))
                } else if (e.key === 'ArrowDown') {
                    setOverlayMenuIndex(i => Math.min(quickMenuItems.length - 1, i + 1))
                } else if (e.key === 'Enter') {
                    activateQuickMenuItem(overlayMenuIndex)
                }
                return
            }

            switch (e.key) {
                case 'ArrowLeft':
                    navigateGames('left') // Left = previous game
                    break
                case 'ArrowRight':
                    navigateGames('right') // Right = next game
                    break
                case 'ArrowUp':
                    navigateNav('left') // Up = previous tab
                    break
                case 'ArrowDown':
                    navigateNav('right') // Down = next tab
                    break
                case 'Enter':
                case ' ':
                    if (focusArea === 'nav') {
                        selectNavItem()
                    } else if (selectedGame) {
                        onPlay(selectedGame)
                    }
                    break
                case 'Escape':
                case 'Backspace':
                    requestClose()
                    break
                case 'Tab':
                    setShowQuickMenu(prev => !prev)
                    break
                case 'v':
                case 'V':
                    toggleViewMode()
                    break
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [
        focusArea,
        showQuickMenu,
        showExitConfirm,
        selectedGame,
        navigateGames,
        navigateNav,
        selectNavItem,
        onPlay,
        requestClose,
        confirmExit,
        cancelExit,
        toggleViewMode,
        quickMenuItems,
        overlayMenuIndex,
        activateQuickMenuItem,
        exitFocusIndex,
        confirmExit,
        cancelExit,
        inputBlocked
    ])

    // Format time
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const formatDate = (date: Date) => {
        return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    }

    const confirmLabel = controllerLayout === 'nintendo' ? 'B' : 'A'
    const backLabel = controllerLayout === 'nintendo' ? 'A' : 'B'

    return (
        <div
            ref={containerRef}
            className={`fs-container fs-theme-${fullscreenTheme}${lowEffects ? ' fs-low-effects' : ''}`}
            data-console={fullscreenTheme}
        >
            {/* Animated Background */}
            <div className="fs-background">
                {selectedGame && (
                    <img 
                        src={selectedGame.backgroundUrl || selectedGame.coverUrl} 
                        alt="" 
                        className={`fs-bg-image ${isTransitioning ? 'transitioning' : ''}`}
                        key={selectedGame.id}
                    />
                )}
                <div className="fs-bg-overlay" />
                <div className="fs-bg-gradient" />
                
                {/* Ambient Particles */}
                <div className="fs-particles">
                    {particles.map(p => (
                        <div
                            key={p.id}
                            className="fs-particle"
                            style={{
                                left: `${p.x}%`,
                                top: `${p.y}%`,
                                width: `${p.size}px`,
                                height: `${p.size}px`,
                                opacity: p.opacity,
                                animationDuration: `${20 / p.speed}s`
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Top Bar */}
            <header ref={headerRef} className="fs-header">
                <div className="fs-logo">
                    <span className="fs-logo-icon"><FsGamepadIcon size={28} /></span>
                    <span className="fs-logo-text">{APP_NAME}</span>
                </div>

                <nav ref={navRef} className={`fs-nav ${focusArea === 'nav' ? 'focused' : ''}`}>
                    <div className="fs-nav-row fs-nav-library">
                    {libraryNavItems.map(item => {
                        const index = navItems.findIndex(n => n.id === item.id)
                        return (
                        <button
                            key={item.id}
                            type="button"
                            title={item.label}
                            className={`fs-nav-item ${activeFilter === item.id ? 'active' : ''} ${focusArea === 'nav' && selectedNavIndex === index ? 'focused' : ''}`}
                            onClick={() => {
                                setActiveFilter(item.id)
                                setSelectedNavIndex(index)
                            }}
                        >
                            <span className="fs-nav-icon">
                                {isFullscreenLibraryFilter(item.id) ? (
                                    <FsNavFilterIcon id={item.id} />
                                ) : (
                                    <PlatformIcon platform={item.id as Platform} width={18} height={18} />
                                )}
                            </span>
                            <span className="fs-nav-label">{item.label}</span>
                            {activeFilter === item.id && <div className="fs-nav-indicator" />}
                        </button>
                        )
                    })}
                    </div>
                    <div className="fs-nav-row fs-nav-platforms">
                    {platformNavItems.map(item => {
                        const index = navItems.findIndex(n => n.id === item.id)
                        return (
                        <button
                            key={item.id}
                            type="button"
                            title={PLATFORMS[item.id as Platform]?.name ?? item.label}
                            className={`fs-nav-item ${activeFilter === item.id ? 'active' : ''} ${focusArea === 'nav' && selectedNavIndex === index ? 'focused' : ''}`}
                            onClick={() => {
                                setActiveFilter(item.id)
                                setSelectedNavIndex(index)
                            }}
                        >
                            <span className="fs-nav-icon">
                                <PlatformIcon platform={item.id as Platform} width={18} height={18} />
                            </span>
                            <span className="fs-nav-label">{item.label}</span>
                            {activeFilter === item.id && <div className="fs-nav-indicator" />}
                        </button>
                        )
                    })}
                    </div>
                </nav>

                <div className="fs-header-right">
                    {/* Controller indicator */}
                    {controllerConnected && (
                        <div className="fs-controller-indicator">
                            <span className="fs-controller-icon"><FsControllerIcon /></span>
                            <span className="fs-controller-text">Controller</span>
                        </div>
                    )}
                    
                    {onAddGame && (
                        <button
                            type="button"
                            className="fs-toolbar-btn"
                            onClick={onAddGame}
                            title={t('fullscreen.addGame')}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                <path d="M12 5v14M5 12h14" />
                            </svg>
                            <span>{t('fullscreen.addGame')}</span>
                        </button>
                    )}

                    {onOpenSettings && (
                        <button
                            type="button"
                            className="fs-toolbar-btn"
                            onClick={onOpenSettings}
                            title={t('fullscreen.settings')}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                            </svg>
                            <span>{t('fullscreen.settings')}</span>
                        </button>
                    )}

                    <div className="fs-view-toggle">
                        <button 
                            type="button"
                            className={`fs-view-btn ${viewMode === 'horizontal' ? 'active' : ''}`}
                            onClick={() => setViewMode('horizontal')}
                            title={t('fullscreen.viewCarousel')}
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                                <rect x="2" y="8" width="6" height="8" rx="1" />
                                <rect x="9" y="8" width="6" height="8" rx="1" />
                                <rect x="16" y="8" width="6" height="8" rx="1" />
                            </svg>
                        </button>
                        <button 
                            type="button"
                            className={`fs-view-btn ${viewMode === 'vertical' ? 'active' : ''}`}
                            onClick={() => setViewMode('vertical')}
                            title={t('fullscreen.viewConsole')}
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                                <rect x="2" y="4" width="12" height="16" rx="2" />
                                <rect x="16" y="6" width="6" height="5" rx="1" />
                                <rect x="16" y="13" width="6" height="5" rx="1" />
                            </svg>
                        </button>
                    </div>
                    
                    {/* Refresh Metadata Button */}
                    {onRefreshMetadata && (
                        <button 
                            className={`fs-refresh-btn ${isRefreshing ? 'refreshing' : ''}`}
                            onClick={onRefreshMetadata}
                            disabled={isRefreshing}
                            title="Refresh game metadata & descriptions"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                <path d="M21 12a9 9 0 11-9-9c2.52 0 4.83.82 6.71 2.2" />
                                <path d="M21 3v6h-6" />
                            </svg>
                            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                        </button>
                    )}
                    
                    {powerState && powerState.level != null && (
                        <div className="fs-battery" title={powerState.charging ? 'Charging' : 'On battery'}>
                            <span className="fs-battery-icon"><FsBatteryIcon charging={powerState.charging} /></span>
                            <span className="fs-battery-level">{powerState.level}%</span>
                        </div>
                    )}

                    <div className="fs-datetime">
                        <span className="fs-time">{formatTime(time)}</span>
                        <span className="fs-date">{formatDate(time)}</span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="fs-main">
                {filteredGames.length === 0 ? (
                    <div className="fs-empty">
                        <div className="fs-empty-icon"><FsEmptyIcon size={56} /></div>
                        <h2>No games found</h2>
                        <p>Try selecting a different filter</p>
                    </div>
                ) : (
                    <>
                        {/* Hero Section - Big Game Display */}
                        {selectedGame && viewMode === 'horizontal' && (
                            <div className="fs-hero-section">
                                <FullscreenGameGallery
                                    variant="hero"
                                    images={galleryImages}
                                    activeIndex={activeScreenshot}
                                    onSelect={setActiveScreenshot}
                                    gameId={selectedGame.id}
                                    gameName={selectedGame.name}
                                />
                                
                                <div className="fs-hero-content">
                                    <div className="fs-game-meta">
                                        <span className="fs-platform-badge">
                                            <PlatformIcon platform={selectedGame.platform} width={20} height={20} />
                                            {getPlatformInfo(selectedGame.platform).name}
                                        </span>
                                        {selectedGame.isInstalled !== false && (
                                            <span className="fs-installed-badge"><FsCheckIcon size={12} /> Installed</span>
                                        )}
                                        {selectedGame.genres && selectedGame.genres.length > 0 && (
                                            <span className="fs-genre">{selectedGame.genres.slice(0, 2).join(' · ')}</span>
                                        )}
                                    </div>
                                    <h1 className="fs-game-title">{selectedGame.name}</h1>
                                    {selectedGame.description && (
                                        <div className="fs-about-section">
                                            <h3 className="fs-about-title">About This Game</h3>
                                            <p className="fs-game-desc">
                                                {selectedGame.description.slice(0, 400)}
                                                {selectedGame.description.length > 400 ? '...' : ''}
                                            </p>
                                        </div>
                                    )}
                                    <div className="fs-game-stats">
                                        {selectedGame.developer && (
                                            <span className="fs-stat">
                                                <span className="fs-stat-label">Developer</span>
                                                <span className="fs-stat-value">{selectedGame.developer}</span>
                                            </span>
                                        )}
                                        {selectedGame.releaseDate && (
                                            <span className="fs-stat">
                                                <span className="fs-stat-label">Released</span>
                                                <span className="fs-stat-value">{new Date(selectedGame.releaseDate).getFullYear()}</span>
                                            </span>
                                        )}
                                        {selectedGame.rating && (
                                            <span className="fs-stat">
                                                <span className="fs-stat-label">Rating</span>
                                                <span className="fs-stat-value"><FsStarIcon size={14} filled className="fs-rating-star" /> {selectedGame.rating.toFixed(1)}</span>
                                            </span>
                                        )}
                                    </div>
                                    <div className="fs-game-actions">
                                        <button className="fs-btn-play" onClick={() => onPlay(selectedGame)}>
                                            <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
                                                <path d="M8 5v14l11-7z" />
                                            </svg>
                                            <span>{primaryActionLabel(selectedGame)}</span>
                                        </button>
                                        {selectedGame.isFavorite && (
                                            <span className="fs-favorite-badge"><FsHeartIcon size={14} /> Favorite</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Horizontal Carousel View */}
                        {viewMode === 'horizontal' && (
                            <div className={`fs-carousel ${focusArea === 'games' ? 'focused' : ''}`}>
                                <div className="fs-carousel-header">
                                    <span className="fs-carousel-title">Library</span>
                                    <span className="fs-carousel-count">{filteredGames.length} games</span>
                                </div>
                                <div
                                    className="fs-game-list"
                                    ref={gameListRef}
                                    onTouchStart={handleTouchStart}
                                    onTouchEnd={handleTouchEnd}
                                >
                                    {filteredGames.map((game, index) => (
                                        <div
                                            key={game.id}
                                            className={`fs-game-card ${index === selectedGameIndex ? 'selected' : ''}`}
                                            onClick={() => {
                                                setSelectedGameIndex(index)
                                                setFocusArea('games')
                                            }}
                                            onDoubleClick={() => onPlay(game)}
                                        >
                                            <div className="fs-card-inner">
                                                {game.customCoverUrl || game.coverUrl ? (
                                                    <img 
                                                        src={game.customCoverUrl || game.coverUrl} 
                                                        alt={game.name}
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="fs-card-placeholder">
                                                        <PlatformIcon platform={game.platform} width={40} height={40} />
                                                        <span className="fs-card-placeholder-name">{game.name}</span>
                                                    </div>
                                                )}
                                                {game.isFavorite && (
                                                    <span className="fs-card-favorite"><FsHeartIcon size={12} /></span>
                                                )}
                                                <div className="fs-card-select-bar" />
                                            </div>
                                            <span className="fs-card-name">{game.name}</span>
                                        </div>
                                    ))}
                                </div>
                                
                                {filteredGames.length > 5 && (
                                    <>
                                        <button 
                                            className="fs-carousel-arrow fs-arrow-left"
                                            onClick={() => navigateGames('left')}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M15 18l-6-6 6-6" />
                                            </svg>
                                        </button>
                                        <button 
                                            className="fs-carousel-arrow fs-arrow-right"
                                            onClick={() => navigateGames('right')}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M9 18l6-6-6-6" />
                                            </svg>
                                        </button>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Immersive Horizontal View */}
                        {viewMode === 'vertical' && selectedGame && (
                            <div className="fs-immersive-view">
                                {/* Full Background */}
                                <div className="fs-immersive-bg">
                                    <img 
                                        src={selectedGame.backgroundUrl || selectedGame.coverUrl} 
                                        alt=""
                                        key={selectedGame.id}
                                    />
                                    <div className="fs-immersive-overlay" />
                                </div>

                                {/* Left Panel - Game Info */}
                                <div className="fs-immersive-left">
                                    <div className="fs-immersive-info">
                                    <div className="fs-immersive-platform">
                                        <PlatformIcon platform={selectedGame.platform} width={22} height={22} />
                                        <span>{getPlatformInfo(selectedGame.platform).name}</span>
                                    </div>

                                    <h1 className="fs-immersive-title">{selectedGame.name}</h1>

                                    {/* Meta Info */}
                                    <div className="fs-immersive-meta">
                                        {selectedGame.releaseDate && (
                                            <span>{new Date(selectedGame.releaseDate).getFullYear()}</span>
                                        )}
                                        {selectedGame.developer && (
                                            <>
                                                <span className="fs-immersive-sep">|</span>
                                                <span>DEVELOPER: {selectedGame.developer}</span>
                                            </>
                                        )}
                                        {selectedGame.publisher && selectedGame.publisher !== selectedGame.developer && (
                                            <>
                                                <span className="fs-immersive-sep">|</span>
                                                <span>PUBLISHER: {selectedGame.publisher}</span>
                                            </>
                                        )}
                                    </div>

                                    {/* Genres */}
                                    {selectedGame.genres && selectedGame.genres.length > 0 && (
                                        <div className="fs-immersive-genres">
                                            {selectedGame.genres.slice(0, 3).map((genre, idx) => (
                                                <span key={idx} className="fs-immersive-genre-tag">{genre}</span>
                                            ))}
                                        </div>
                                    )}

                                    {/* About This Game */}
                                    {selectedGame.description && (
                                        <div className="fs-immersive-about">
                                            <h3 className="fs-immersive-about-title">About This Game</h3>
                                            <p className="fs-immersive-desc">{selectedGame.description}</p>
                                        </div>
                                    )}

                                    {/* Game Stats */}
                                    <div className="fs-immersive-stats">
                                        {selectedGame.rating && (
                                            <div className="fs-immersive-stat">
                                                <span className="fs-stat-value">
                                                    {[1,2,3,4,5].map(star => (
                                                        <span 
                                                            key={star} 
                                                            className={`fs-star ${star <= Math.round(selectedGame.rating!) ? 'filled' : ''}`}
                                                        ><FsStarIcon size={14} filled={star <= Math.round(selectedGame.rating!)} /></span>
                                                    ))}
                                                </span>
                                                <span className="fs-stat-label">Rating</span>
                                            </div>
                                        )}
                                        {selectedGame.playtime !== undefined && selectedGame.playtime > 0 && (
                                            <div className="fs-immersive-stat">
                                                <span className="fs-stat-value">{Math.round(selectedGame.playtime / 60)}h</span>
                                                <span className="fs-stat-label">Played</span>
                                            </div>
                                        )}
                                        {selectedGame.isInstalled !== false && (
                                            <div className="fs-immersive-stat">
                                                <span className="fs-stat-value fs-installed-icon"><FsCheckIcon size={18} /></span>
                                                <span className="fs-stat-label">Installed</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="fs-immersive-actions">
                                        <button className="fs-immersive-play" onClick={() => onPlay(selectedGame)}>
                                            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                                <path d="M8 5v14l11-7z" />
                                            </svg>
                                            {primaryActionLabel(selectedGame).toUpperCase()}
                                        </button>
                                        {selectedGame.isFavorite && (
                                            <span className="fs-immersive-fav-badge"><FsHeartIcon size={14} /> FAVORITE</span>
                                        )}
                                    </div>
                                    </div>

                                    <FullscreenGameGallery
                                        variant="immersive"
                                        images={galleryImages}
                                        activeIndex={activeScreenshot}
                                        onSelect={setActiveScreenshot}
                                        gameId={selectedGame.id}
                                        gameName={selectedGame.name}
                                    />
                                </div>

                                {/* Right Panel - Horizontal Carousel */}
                                <div className="fs-immersive-right">
                                    <div className="fs-immersive-carousel" ref={gameListRef}>
                                        {filteredGames.map((game, index) => {
                                            // Calculate position relative to selected
                                            const offset = index - selectedGameIndex
                                            const isVisible = Math.abs(offset) <= 4
                                            
                                            if (!isVisible) return null
                                            
                                            return (
                                                <div
                                                    key={game.id}
                                                    className={`fs-carousel-item ${offset === 0 ? 'selected' : ''}`}
                                                    style={{
                                                        transform: `translateX(${offset * 140}px) scale(${offset === 0 ? 1 : 0.7 - Math.abs(offset) * 0.05})`,
                                                        opacity: offset === 0 ? 1 : 0.6 - Math.abs(offset) * 0.12,
                                                        zIndex: 10 - Math.abs(offset)
                                                    }}
                                                    onClick={() => setSelectedGameIndex(index)}
                                                    onDoubleClick={() => onPlay(game)}
                                                >
                                                    <div className="fs-carousel-item-inner">
                                                        {game.customCoverUrl || game.coverUrl ? (
                                                            <img 
                                                                src={game.customCoverUrl || game.coverUrl} 
                                                                alt={game.name}
                                                                loading="lazy"
                                                            />
                                                        ) : (
                                                            <div className="fs-carousel-item-placeholder">
                                                                <PlatformIcon platform={game.platform} width={32} height={32} />
                                                                <span>{game.name.slice(0, 15)}</span>
                                                            </div>
                                                        )}
                                                        {game.isFavorite && <span className="fs-carousel-item-fav"><FsHeartIcon size={10} /></span>}
                                                    </div>
                                                    {offset === 0 && (
                                                        <div className="fs-carousel-item-glow" />
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                    
                                    {/* Navigation hint */}
                                    <div className="fs-carousel-nav-hint">
                                        <span>?</span>
                                        <span className="fs-carousel-counter">{selectedGameIndex + 1} / {filteredGames.length}</span>
                                        <span>?</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* Footer with Controls */}
            <footer ref={footerRef} className="fs-footer">
                <div className="fs-controls">
                    <div className="fs-control">
                        <span className="fs-control-key">←</span>
                        <span className="fs-control-key">→</span>
                        <span className="fs-control-label">Games</span>
                    </div>
                    <div className="fs-control">
                        <span className="fs-control-btn fs-btn-lb">LB</span>
                        <span className="fs-control-btn fs-btn-rb">RB</span>
                        <span className="fs-control-label">Tabs</span>
                    </div>
                    <div className="fs-control">
                        <span className="fs-control-key">V</span>
                        <span className="fs-control-label">View</span>
                    </div>
                    <div className="fs-control">
                        <span className="fs-control-key">Enter</span>
                        <span className="fs-control-label">Play</span>
                    </div>
                    <div className="fs-control">
                        <span className="fs-control-key">Esc</span>
                        <span className="fs-control-label">Exit</span>
                    </div>
                </div>
                
                {controllerConnected ? (
                    <div className="fs-gamepad-controls">
                        <div className="fs-control">
                            <span className="fs-control-btn fs-btn-dpad">←</span>
                            <span className="fs-control-btn fs-btn-dpad">→</span>
                            <span className="fs-control-label">Games</span>
                        </div>
                        <div className="fs-control">
                            <span className="fs-control-btn fs-btn-lb">LB</span>
                            <span className="fs-control-btn fs-btn-rb">RB</span>
                            <span className="fs-control-label">Tabs</span>
                        </div>
                        <div className="fs-control">
                            <span className="fs-control-btn fs-btn-a">{confirmLabel}</span>
                            <span className="fs-control-label">Play</span>
                        </div>
                        <div className="fs-control">
                            <span className="fs-control-btn fs-btn-b">{backLabel}</span>
                            <span className="fs-control-label">Exit</span>
                        </div>
                        <div className="fs-control">
                            <span className="fs-control-btn fs-btn-lb">LB</span>
                            <span className="fs-control-btn fs-btn-rb">RB</span>
                            <span className="fs-control-label">Quick Switch</span>
                        </div>
                    </div>
                ) : (
                    <div className="fs-gamepad-controls fs-gamepad-hint">
                        <span><FsControllerIcon size={14} /> Connect controller for gamepad support</span>
                    </div>
                )}
            </footer>

            {showExitConfirm && (
                <div className="fs-quick-menu-overlay" onClick={cancelExit}>
                    <div className="fs-quick-menu fs-exit-dialog" onClick={e => e.stopPropagation()}>
                        <h2>{t('fullscreen.exitTitle')}</h2>
                        <p>{t('fullscreen.exitMessage')}</p>
                        <div className="fs-exit-dialog-actions">
                            <button
                                type="button"
                                className={`fs-quick-item ${exitFocusIndex === 0 ? 'focused' : ''}`}
                                onClick={cancelExit}
                            >
                                {t('fullscreen.exitCancel')}
                            </button>
                            <button
                                type="button"
                                className={`fs-quick-item danger ${exitFocusIndex === 1 ? 'focused' : ''}`}
                                onClick={confirmExit}
                            >
                                {t('fullscreen.exitConfirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {libraryBusy?.active && (
                <div className="fs-library-busy" role="status">
                    <p className="fs-library-busy-text">
                        {libraryBusy.message || t('loading.scanning')}
                    </p>
                    {libraryBusy.total > 0 && (
                        <>
                            <div className="fs-library-busy-bar">
                                <div
                                    className="fs-library-busy-fill"
                                    style={{
                                        width: `${Math.min(100, (libraryBusy.progress / libraryBusy.total) * 100)}%`
                                    }}
                                />
                            </div>
                            <span className="fs-library-busy-count">
                                {libraryBusy.progress} / {libraryBusy.total}
                            </span>
                        </>
                    )}
                    {libraryBusy.onCancel && (
                        <button type="button" className="fs-library-busy-cancel" onClick={libraryBusy.onCancel}>
                            {t('common.back')}
                        </button>
                    )}
                </div>
            )}

            {showQuickMenu && (
                <div className="fs-quick-menu-overlay" onClick={() => setShowQuickMenu(false)}>
                    <div className="fs-quick-menu" onClick={e => e.stopPropagation()}>
                        <h2>{t('fullscreen.quickMenu')}</h2>
                        <div className="fs-quick-menu-items" ref={overlayMenuRef}>
                            {quickMenuItems.map((item, index) => (
                                <button
                                    key={item.action}
                                    type="button"
                                    className={`fs-quick-item ${overlayMenuIndex === index ? 'focused' : ''}`}
                                    onClick={() => activateQuickMenuItem(index)}
                                >
                                    <span className="fs-quick-icon">
                                        <FsQuickMenuIcon action={item.action} horizontal={viewMode === 'horizontal'} />
                                    </span>
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </div>
                        <p className="fs-quick-hint">
                            {t('fullscreen.menuNavigate')} · <span className="fs-control-btn fs-btn-a">{confirmLabel}</span> {t('fullscreen.menuSelect')} · <span className="fs-control-btn fs-btn-b">{backLabel}</span> {t('fullscreen.menuBack')}
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

interface FullscreenGameGalleryProps {
    variant: 'hero' | 'immersive'
    images: string[]
    activeIndex: number
    onSelect: (index: number) => void
    gameId: string
    gameName: string
}

function FullscreenGameGallery({
    variant,
    images,
    activeIndex,
    onSelect,
    gameId,
    gameName
}: FullscreenGameGalleryProps) {
    if (images.length === 0) return null

    const safeIndex = Math.min(activeIndex, images.length - 1)
    const mainSrc = images[safeIndex]
    const cycle = (delta: number) => {
        onSelect((safeIndex + delta + images.length) % images.length)
    }

    if (variant === 'immersive') {
        return (
            <div className="fs-immersive-gallery">
                <div className="fs-immersive-gallery-main">
                    <img src={mainSrc} alt={`${gameName} preview`} key={`${gameId}-${safeIndex}`} />
                    {images.length > 1 && (
                        <>
                            <button
                                type="button"
                                className="fs-gallery-arrow fs-gallery-prev"
                                onClick={() => cycle(-1)}
                                aria-label="Previous image"
                            >
                                ?
                            </button>
                            <button
                                type="button"
                                className="fs-gallery-arrow fs-gallery-next"
                                onClick={() => cycle(1)}
                                aria-label="Next image"
                            >
                                ?
                            </button>
                        </>
                    )}
                </div>
                <div className="fs-immersive-gallery-strip">
                    {images.map((src, idx) => (
                        <button
                            key={`${src}-${idx}`}
                            type="button"
                            className={`fs-immersive-gallery-thumb ${idx === safeIndex ? 'active' : ''}`}
                            onClick={() => onSelect(idx)}
                            aria-label={`Image ${idx + 1} of ${images.length}`}
                        >
                            <img src={src} alt="" loading="lazy" />
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="fs-hero-media">
            <div className="fs-hero-image-container">
                <img
                    src={mainSrc}
                    alt={gameName}
                    className="fs-hero-artwork"
                    key={`${gameId}-${safeIndex}`}
                />
                <div className="fs-hero-fade" />
                {images.length > 1 && (
                    <div className="fs-screenshot-indicators">
                        {images.map((_, idx) => (
                            <button
                                key={idx}
                                type="button"
                                className={`fs-screenshot-dot ${idx === safeIndex ? 'active' : ''}`}
                                onClick={() => onSelect(idx)}
                                aria-label={`Image ${idx + 1}`}
                            />
                        ))}
                    </div>
                )}
            </div>
            <div className="fs-screenshot-thumbs">
                {images.map((screenshot, idx) => (
                    <button
                        key={`${screenshot}-${idx}`}
                        type="button"
                        className={`fs-screenshot-thumb ${idx === safeIndex ? 'active' : ''}`}
                        onClick={() => onSelect(idx)}
                    >
                        <img src={screenshot} alt={`Screenshot ${idx + 1}`} loading="lazy" />
                    </button>
                ))}
            </div>
        </div>
    )
}

export default FullscreenView
