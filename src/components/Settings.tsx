import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
    Collection,
    Settings as AppSettings,
    UserData,
    HandheldDefaultFilter,
    ControllerLayout,
    UiScale,
    CloseButtonAction,
    WindowsPowerPlan,
    TdpPreset
} from '../types/game'
import { applyGamingFromSettings } from '../utils/gamingSettings'
import { applyTdpFromSettings } from '../utils/tdpSettings'
import { TdpControl } from './TdpControl'
import { useLanguage } from '../context/LanguageContext'
import { useGamepadInput } from '../hooks/useGamepadInput'
import { ControllerStatus } from './ControllerStatus'
import { FullscreenControlsSettings } from './FullscreenControlsSettings'
import { DEFAULT_FULLSCREEN_CONTROLS } from '../types/fullscreenControls'
import { mergeFullscreenControls } from '../utils/fullscreenControls'
import { showAppMessage } from '../utils/showAppMessage'
import {
    activateFocusable,
    applySettingsFocusRing,
    cycleSelectValue,
    getModalFocusables
} from '../utils/settingsFocus'
import { THEME_OPTIONS, THEME_IDS, type ThemeId } from '../utils/themeOptions'

interface SettingsProps {
    settings: AppSettings
    collections: Collection[]
    onSave: (settings: AppSettings) => void
    onClose: () => void
    onSyncSteam: () => void
    onSyncEpic: () => void
    onSyncGog: () => void
    isSyncing: boolean
    onAddCollection: (collection: Collection) => void
    onDeleteCollection: (collectionId: string) => void
    onImportData: (data: UserData) => void
    fullUserData: UserData // Passing full data for export
}

const COLLECTION_ICONS = ['📁', '🎮', '⭐', '❤️', '🔥', '💎', '🎯', '🏆', '💀', '🚀', '🏎️', '⚽', '🎨', '🎵', '📺', '📚', '💡', '📌', '👾', '🌈', '💜', '🟢', '🔴', '⚡', '🤖', '👻', '🧩', '🎲', '♟️', '🛡️']

export const Settings: React.FC<SettingsProps> = ({
    settings,
    collections,
    onSave,
    onClose,
    onSyncSteam,
    onSyncEpic,
    onSyncGog,
    isSyncing,
    onAddCollection,
    onDeleteCollection,
    onImportData,
    fullUserData
}) => {
    const { t, language, setLanguage } = useLanguage()
    const settingsContentRef = useRef<HTMLDivElement>(null)
    const settingsModalRef = useRef<HTMLDivElement>(null)
    const [focusIndex, setFocusIndex] = useState(0)

    // General Settings
    const [theme, setTheme] = useState(settings.theme)
    const [gridSize, setGridSize] = useState(settings.gridSize)
    const [showHidden, setShowHidden] = useState(settings.showHidden)
    const [enableAnimations, setEnableAnimations] = useState(settings.enableAnimations)
    const [autoScrape, setAutoScrape] = useState(settings.autoScrape)
    const [autoStart, setAutoStart] = useState(settings.autoStart)

    // Handheld (Windows)
    const [handheldMode, setHandheldMode] = useState(settings.handheldMode ?? false)
    const [handheldAutoDetect, setHandheldAutoDetect] = useState(settings.handheldAutoDetect !== false)
    const [handheldStartFullscreen, setHandheldStartFullscreen] = useState(settings.handheldStartFullscreen !== false)
    const [handheldDefaultFilter, setHandheldDefaultFilter] = useState<HandheldDefaultFilter>(
        settings.handheldDefaultFilter ?? 'installed'
    )
    const [minimizeOnPlay, setMinimizeOnPlay] = useState(settings.minimizeOnPlay !== false)
    const [lowEffects, setLowEffects] = useState(settings.lowEffects ?? false)
    const [scrapeOnAcOnly, setScrapeOnAcOnly] = useState(settings.scrapeOnAcOnly ?? false)
    const [controllerLayout, setControllerLayout] = useState<ControllerLayout>(settings.controllerLayout ?? 'xbox')
    const [fullscreenControls, setFullscreenControls] = useState(
        () => mergeFullscreenControls(settings.fullscreenControls)
    )
    const [fullscreenTheme, setFullscreenTheme] = useState(settings.fullscreenTheme ?? 'xbox')
    const [uiScale, setUiScale] = useState<UiScale>(settings.uiScale ?? '100')

    const [tdpEnabled, setTdpEnabled] = useState(settings.tdpEnabled ?? false)
    const [tdpPreset, setTdpPreset] = useState<TdpPreset>(settings.tdpPreset ?? 'balanced')
    const [tdpCustomWatts, setTdpCustomWatts] = useState(settings.tdpCustomWatts ?? 15)
    const [ryzenAdjPath, setRyzenAdjPath] = useState(settings.ryzenAdjPath ?? '')
    const [tdpApplyOnStart, setTdpApplyOnStart] = useState(settings.tdpApplyOnStart ?? false)
    const [tdpApplyOnGameLaunch, setTdpApplyOnGameLaunch] = useState(settings.tdpApplyOnGameLaunch !== false)

    // Windows gaming
    const [preventDisplaySleep, setPreventDisplaySleep] = useState(settings.preventDisplaySleep !== false)
    const [preventSleepWhilePlaying, setPreventSleepWhilePlaying] = useState(settings.preventSleepWhilePlaying !== false)
    const [alwaysOnTop, setAlwaysOnTop] = useState(settings.alwaysOnTop ?? false)
    const [rememberWindowBounds, setRememberWindowBounds] = useState(settings.rememberWindowBounds !== false)
    const [closeButtonAction, setCloseButtonAction] = useState<CloseButtonAction>(settings.closeButtonAction ?? 'ask')
    const [globalHotkeyEnabled, setGlobalHotkeyEnabled] = useState(settings.globalHotkeyEnabled !== false)
    const [windowsPowerPlan, setWindowsPowerPlan] = useState<WindowsPowerPlan>(settings.windowsPowerPlan ?? 'leave')
    const [restorePowerPlanOnExit, setRestorePowerPlanOnExit] = useState(settings.restorePowerPlanOnExit !== false)

    // Steam Integration
    const [steamId, setSteamId] = useState(settings.steamId || '')
    const [steamApiKey, setSteamApiKey] = useState(settings.steamApiKey || '')
    const [legendaryPath, setLegendaryPath] = useState(settings.legendaryPath || '')
    const [gogGalaxyDbPath, setGogGalaxyDbPath] = useState(settings.gogGalaxyDbPath || '')
    const [isLoggingIn, setIsLoggingIn] = useState(false)
    const [loginError, setLoginError] = useState<string | null>(null)
    const [epicLoginError, setEpicLoginError] = useState<string | null>(null)
    const [gogLoginError, setGogLoginError] = useState<string | null>(null)
    const [legendaryStatus, setLegendaryStatus] = useState<{
        available: boolean
        authenticated: boolean
        account?: string
        executable?: string | null
        bundled?: boolean
        downloaded?: boolean
        error?: string
    } | null>(null)
    const [epicToolDownloading, setEpicToolDownloading] = useState(false)

    // Collection Manager
    const [newCollectionName, setNewCollectionName] = useState('')
    const [selectedIcon, setSelectedIcon] = useState(COLLECTION_ICONS[0])

    const fileInputRef = useRef<HTMLInputElement>(null)
    const epicAuthPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const isConnected = Boolean(steamId)
    const epicConnected = Boolean(legendaryStatus?.authenticated)
    const [gogStatus, setGogStatus] = useState<{
        available: boolean
        databasePath?: string | null
        gamesAvailable?: number
        error?: string
    } | null>(null)
    const gogCanSync = Boolean(gogStatus?.available && gogStatus?.databasePath)
    const gogReady = Boolean(gogCanSync && !gogStatus?.error && (gogStatus?.gamesAvailable ?? 0) > 0)

    const refreshGogStatus = useCallback(async () => {
        if (!window.electronAPI?.gogStatus) {
            setGogStatus({ available: false, error: 'Desktop app only' })
            return
        }
        const status = await window.electronAPI.gogStatus(gogGalaxyDbPath || undefined)
        setGogStatus(status)
    }, [gogGalaxyDbPath])

    useEffect(() => {
        void refreshGogStatus()
    }, [refreshGogStatus])

    const refreshLegendaryStatus = useCallback(async () => {
        if (!window.electronAPI?.legendaryStatus) {
            setLegendaryStatus({ available: false, authenticated: false, error: 'Desktop app only' })
            return null
        }
        const status = await window.electronAPI.legendaryStatus(legendaryPath || undefined)
        setLegendaryStatus(status)
        return status
    }, [legendaryPath])

    const stopEpicAuthPolling = useCallback(() => {
        if (epicAuthPollRef.current) {
            clearInterval(epicAuthPollRef.current)
            epicAuthPollRef.current = null
        }
    }, [])

    const startEpicAuthStatusPolling = useCallback(() => {
        stopEpicAuthPolling()
        let attempts = 0
        epicAuthPollRef.current = setInterval(() => {
            void (async () => {
                attempts += 1
                const status = await refreshLegendaryStatus()
                if (status?.authenticated || attempts >= 40) {
                    stopEpicAuthPolling()
                }
            })()
        }, 3000)
    }, [refreshLegendaryStatus, stopEpicAuthPolling])

    useEffect(() => {
        void refreshLegendaryStatus()
    }, [refreshLegendaryStatus])

    useEffect(() => {
        const onFocus = () => void refreshLegendaryStatus()
        window.addEventListener('focus', onFocus)
        return () => {
            window.removeEventListener('focus', onFocus)
            stopEpicAuthPolling()
        }
    }, [refreshLegendaryStatus, stopEpicAuthPolling])

    const handleSteamLogin = async () => {
        setIsLoggingIn(true)
        setLoginError(null)

        try {
            const result = await window.electronAPI.steamLogin()

            if (result.success && result.steamId) {
                setSteamId(result.steamId)
                // Save immediately and trigger sync
                onSave({
                    theme: theme as any,
                    gridSize: gridSize as any,
                    showHidden,
                    enableAnimations,
                    autoScrape,
                    autoStart,
                    steamId: result.steamId, // Use result.steamId here
                    steamApiKey,
                    language
                })
                // Give time for save to complete
                setTimeout(() => {
                    onSyncSteam()
                }, 500)
            } else {
                setLoginError(result.error || 'Login failed')
            }
        } catch (error) {
            setLoginError('Login failed - please try again')
            console.error('Steam login error:', error)
        }

        setIsLoggingIn(false)
    }

    const handleLogout = () => {
        setSteamId('')
        onSave({
            ...settings,
            steamId: '',
            autoScrape,
            autoStart,
            language
        })
    }

    const buildSettings = (): AppSettings => ({
        ...settings,
        theme: theme as AppSettings['theme'],
        gridSize: gridSize as AppSettings['gridSize'],
        showHidden,
        enableAnimations,
        autoScrape,
        autoStart,
        steamId,
        steamApiKey,
        legendaryPath: legendaryPath.trim() || undefined,
        gogGalaxyDbPath: gogGalaxyDbPath.trim() || undefined,
        language,
        handheldMode,
        handheldAutoDetect,
        handheldStartFullscreen,
        handheldDefaultFilter,
        minimizeOnPlay,
        lowEffects,
        scrapeOnAcOnly,
        controllerLayout,
        fullscreenControls,
        fullscreenTheme,
        uiScale,
        preventDisplaySleep,
        preventSleepWhilePlaying,
        alwaysOnTop,
        rememberWindowBounds,
        closeButtonAction,
        globalHotkeyEnabled,
        windowsPowerPlan,
        restorePowerPlanOnExit,
        tdpEnabled,
        tdpPreset,
        tdpCustomWatts,
        ryzenAdjPath,
        tdpApplyOnStart,
        tdpApplyOnGameLaunch
    })

    const handleSave = () => {
        const next = buildSettings()
        void applyGamingFromSettings(next)
        if (next.tdpEnabled) {
            void applyTdpFromSettings(next)
        }
        onSave(next)
    }

    const handleExport = () => {
        const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(JSON.stringify(fullUserData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `unified_launcher_backup_${new Date().toISOString().slice(0, 10)}.unl`);
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    const handleImportClick = () => {
        fileInputRef.current?.click()
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string)
                if (json && json.games && Array.isArray(json.games)) {
                    if (window.confirm(t('settings.confirmImport'))) {
                        onImportData(json)
                        void showAppMessage(t('settings.importSuccess'), { type: 'info' })
                    }
                } else {
                    void showAppMessage(t('settings.importError'))
                }
            } catch (error) {
                console.error('Import error:', error)
                void showAppMessage(t('settings.importError'))
            }
        }
        reader.readAsText(file)
        // Reset input
        e.target.value = ''
    }

    // Change language and save immediately
    const changeLanguage = (lang: 'en' | 'ar') => {
        setLanguage(lang)
        onSave({
            ...settings,
            theme: theme as any, // Ensure current state is saved
            language: lang,
            steamId,
            autoScrape,
            autoStart
        })
    }

    const applyTheme = useCallback((themeId: ThemeId) => {
        setTheme(themeId)
        onSave({
            ...settings,
            theme: themeId,
            steamId,
            autoScrape,
            autoStart,
            language
        })
    }, [settings, steamId, autoScrape, autoStart, language, onSave])

    const getFocusables = useCallback(
        () => getModalFocusables(settingsModalRef.current),
        []
    )

    useEffect(() => {
        const id = requestAnimationFrame(() => {
            const items = getFocusables()
            if (focusIndex >= items.length) {
                setFocusIndex(Math.max(0, items.length - 1))
            } else {
                applySettingsFocusRing(items, focusIndex)
            }
        })
        return () => cancelAnimationFrame(id)
    }, [focusIndex, getFocusables])

    useGamepadInput({
        exclusive: true,
        layout: controllerLayout,
        onNavigate: direction => {
            const items = getFocusables()
            if (items.length === 0) return
            const current = items[focusIndex]

            if ((direction === 'left' || direction === 'right') && current instanceof HTMLSelectElement) {
                cycleSelectValue(current, direction)
                return
            }

            if (
                (direction === 'left' || direction === 'right') &&
                current instanceof HTMLButtonElement &&
                current.classList.contains('theme-card')
            ) {
                const idx = THEME_IDS.indexOf(theme as ThemeId)
                const base = idx >= 0 ? idx : 0
                const next =
                    direction === 'right'
                        ? THEME_IDS[(base + 1) % THEME_IDS.length]
                        : THEME_IDS[(base - 1 + THEME_IDS.length) % THEME_IDS.length]
                applyTheme(next)
                return
            }

            if (direction === 'down') {
                setFocusIndex(i => Math.min(items.length - 1, i + 1))
            } else if (direction === 'up') {
                setFocusIndex(i => Math.max(0, i - 1))
            }
        },
        onAction: action => {
            if (action === 'back') {
                onClose()
                return
            }
            if (action === 'menu' || action === 'y') {
                handleSave()
                return
            }
            if (action === 'confirm') {
                const items = getFocusables()
                const el = items[focusIndex]
                if (el) activateFocusable(el)
            }
        }
    })

    const confirmLabel = controllerLayout === 'nintendo' ? 'B' : 'A'
    const backLabel = controllerLayout === 'nintendo' ? 'A' : 'B'

    return (
        <div
            className="modal-overlay settings-modal-overlay"
            onClick={onClose}
            onKeyDown={e => e.stopPropagation()}
        >
            <div
                ref={settingsModalRef}
                className="modal-content settings-modal"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <div className="modal-header">
                    <h2>{t('settings.title')}</h2>
                    <button className="close-btn" onClick={onClose}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="settings-content" ref={settingsContentRef}>
                    {/* Language Settings */}
                    <section className="settings-section">
                        <h3>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                            </svg>
                            {t('settings.language')}
                        </h3>
                        <div className="language-selector" style={{ display: 'flex', gap: '10px' }}>
                            <button
                                className={`btn ${language === 'en' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => changeLanguage('en')}
                            >
                                English
                            </button>
                            <button
                                className={`btn ${language === 'ar' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => changeLanguage('ar')}
                            >
                                العربية
                            </button>
                        </div>
                    </section>

                    {/* Data Management (Import/Export) */}
                    <section className="settings-section">
                        <h3>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            {t('settings.importExport')}
                        </h3>
                        <div className="data-actions" style={{ display: 'flex', gap: '15px', flexDirection: 'column' }}>
                            <div className="data-action-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>{t('settings.exportData')}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{t('settings.exportDesc')}</div>
                                </div>
                                <button className="btn btn-secondary" onClick={handleExport}>
                                    {t('settings.exportData')}
                                </button>
                            </div>

                            <div className="data-action-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>{t('settings.importData')}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{t('settings.importDesc')}</div>
                                </div>
                                <button className="btn btn-secondary" onClick={handleImportClick}>
                                    {t('settings.importData')}
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    accept=".unl,.json"
                                    onChange={handleFileChange}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Steam Integration Section */}
                    <section className="settings-section">
                        <h3>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="5" r="3" />
                                <path d="M12 8v13" />
                                <path d="M5 17l7 4 7-4" />
                            </svg>
                            {t('settings.steam')}
                        </h3>

                        <div className="connection-status">
                            <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
                            {isConnected ? `${t('settings.steamConnected')} (${steamId.slice(-4)})` : t('settings.steamNotConnected')}
                        </div>

                        {!isConnected ? (
                            <div className="steam-login-section">
                                <button
                                    className="btn steam-login-btn"
                                    onClick={handleSteamLogin}
                                    disabled={isLoggingIn}
                                >
                                    {isLoggingIn ? (
                                        <>
                                            <svg className="spinner" width="18" height="18" viewBox="0 0 24 24">
                                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="60" strokeLinecap="round" />
                                            </svg>
                                            Waiting for Steam...
                                        </>
                                    ) : (
                                        <>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                            </svg>
                                            {t('settings.signInSteam')}
                                        </>
                                    )}
                                </button>

                                {loginError && (
                                    <div className="login-error">
                                        {loginError}
                                    </div>
                                )}

                                <p className="steam-login-hint">
                                    Your browser will open to Steam's login page. Sign in to sync your library.
                                </p>
                            </div>
                        ) : (
                            <div className="steam-connected-section">
                                <div className="steam-user-info">
                                    <span className="steam-id-label">Steam ID:</span>
                                    <span className="steam-id-value">{steamId}</span>
                                </div>

                                <div className="steam-actions">
                                    <button
                                        className="btn btn-primary"
                                        onClick={onSyncSteam}
                                        disabled={isSyncing}
                                    >
                                        {isSyncing ? 'Syncing...' : t('settings.syncLibrary')}
                                    </button>

                                    <button
                                        className="btn btn-secondary"
                                        onClick={handleLogout}
                                    >
                                        {t('settings.disconnect')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Epic / Legendary */}
                    <section className="settings-section">
                        <h3>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>
                            {t('settings.epic')}
                        </h3>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
                            {t('settings.epicDesc')}
                        </p>

                        {legendaryStatus?.bundled && (
                            <p style={{ color: 'var(--color-accent-primary)', fontSize: '0.85rem', marginBottom: '12px' }}>
                                {t('settings.epicBundled')}
                            </p>
                        )}

                        <details style={{ marginBottom: '12px' }}>
                            <summary style={{ cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                                {t('settings.epicAdvancedPath')}
                            </summary>
                            <div className="form-group" style={{ marginTop: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                                {t('settings.legendaryPath')}
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    className="input"
                                    value={legendaryPath}
                                    onChange={e => setLegendaryPath(e.target.value)}
                                    placeholder="legendary.exe"
                                    style={{ flex: 1 }}
                                />
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={async () => {
                                        const p = await window.electronAPI?.legendaryBrowse?.()
                                        if (p) setLegendaryPath(p)
                                    }}
                                >
                                    {t('settings.browseLegendary')}
                                </button>
                                <button type="button" className="btn btn-secondary" onClick={() => void refreshLegendaryStatus()}>
                                    {t('settings.rescanLegendary')}
                                </button>
                            </div>
                            </div>
                        </details>

                        <div className="connection-status">
                            <span
                                className={`status-dot ${
                                    legendaryStatus?.available && epicConnected ? 'connected' : 'disconnected'
                                }`}
                            />
                            {!legendaryStatus?.available
                                ? legendaryStatus?.error || t('settings.epicNotInstalled')
                                : epicConnected
                                  ? `${t('settings.epicConnected')}${legendaryStatus.account ? ` (${legendaryStatus.account})` : ''}`
                                  : legendaryStatus?.error
                                    ? legendaryStatus.error
                                    : t('settings.epicNotConnected')}
                        </div>

                        {legendaryStatus?.executable && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>
                                {legendaryStatus.executable}
                                {legendaryStatus.downloaded ? ' (downloaded)' : ''}
                            </p>
                        )}

                        {!legendaryStatus?.available && (
                            <button
                                type="button"
                                className="btn btn-primary"
                                style={{ marginTop: '12px' }}
                                disabled={epicToolDownloading}
                                onClick={async () => {
                                    setEpicToolDownloading(true)
                                    setEpicLoginError(null)
                                    const res = await window.electronAPI?.legendaryDownload?.()
                                    if (!res?.ok) {
                                        setEpicLoginError(res?.error || 'Download failed')
                                    }
                                    await refreshLegendaryStatus()
                                    setEpicToolDownloading(false)
                                }}
                            >
                                {epicToolDownloading ? 'Downloading...' : t('settings.downloadEpicTool')}
                            </button>
                        )}

                        {legendaryStatus?.available && (
                            <div className="steam-actions" style={{ marginTop: '12px', flexWrap: 'wrap' }}>
                                {!epicConnected && (
                                    <>
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={async () => {
                                                setEpicLoginError(null)
                                                const res = await window.electronAPI?.legendaryAuth?.({
                                                    mode: 'interactive',
                                                    customPath: legendaryPath || undefined
                                                })
                                                if (!res?.ok) setEpicLoginError(res?.error || 'Failed to start login')
                                                else startEpicAuthStatusPolling()
                                            }}
                                        >
                                            {t('settings.signInEpicLegendary')}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={async () => {
                                                setEpicLoginError(null)
                                                const res = await window.electronAPI?.legendaryAuth?.({
                                                    mode: 'import',
                                                    customPath: legendaryPath || undefined
                                                })
                                                if (!res?.ok) setEpicLoginError(res?.error || 'Import failed')
                                                else startEpicAuthStatusPolling()
                                            }}
                                        >
                                            {t('settings.importEpicFromLauncher')}
                                        </button>
                                    </>
                                )}
                                {epicConnected && (
                                    <>
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={async () => {
                                                setEpicLoginError(null)
                                                const status = await window.electronAPI?.legendaryStatus?.(
                                                    legendaryPath || undefined
                                                )
                                                if (status) setLegendaryStatus(status)
                                                if (!status?.authenticated) {
                                                    setEpicLoginError(t('settings.epicSignInRequired'))
                                                    return
                                                }
                                                handleSave()
                                                onSyncEpic()
                                            }}
                                            disabled={isSyncing}
                                        >
                                            {isSyncing ? 'Syncing...' : t('settings.syncLibrary')}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={async () => {
                                                await window.electronAPI?.legendaryLogout?.(legendaryPath || undefined)
                                                void refreshLegendaryStatus()
                                            }}
                                        >
                                            {t('settings.disconnect')}
                                        </button>
                                    </>
                                )}
                            </div>
                        )}

                        {epicLoginError && <div className="login-error">{epicLoginError}</div>}

                        <p className="steam-login-hint" style={{ marginTop: '10px' }}>
                            {t('settings.epicLoginHint')}
                        </p>
                    </section>

                    {/* GOG Galaxy */}
                    <section className="settings-section">
                        <h3>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>
                            {t('settings.gog')}
                        </h3>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
                            {t('settings.gogDesc')}
                        </p>

                        {gogReady && (
                            <p style={{ color: 'var(--color-accent-primary)', fontSize: '0.85rem', marginBottom: '12px' }}>
                                {t('settings.gogGalaxyFound')}
                            </p>
                        )}

                        <details style={{ marginBottom: '12px' }}>
                            <summary style={{ cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                                {t('settings.gogAdvancedPath')}
                            </summary>
                            <div className="form-group" style={{ marginTop: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                                {t('settings.gogDbPath')}
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    className="input"
                                    value={gogGalaxyDbPath}
                                    onChange={e => setGogGalaxyDbPath(e.target.value)}
                                    placeholder="galaxy-2.0.db"
                                    style={{ flex: 1 }}
                                />
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={async () => {
                                        const p = await window.electronAPI?.gogBrowse?.()
                                        if (p) setGogGalaxyDbPath(p)
                                    }}
                                >
                                    {t('settings.browseGogDb')}
                                </button>
                                <button type="button" className="btn btn-secondary" onClick={() => void refreshGogStatus()}>
                                    {t('settings.rescanGog')}
                                </button>
                            </div>
                            </div>
                        </details>

                        <div className="connection-status">
                            <span className={`status-dot ${gogReady ? 'connected' : 'disconnected'}`} />
                            {!gogStatus?.available
                                ? gogStatus?.error || t('settings.gogNotFound')
                                : gogReady
                                  ? `${t('settings.gogConnected')} (${gogStatus.gamesAvailable} games)`
                                  : gogStatus?.error || t('settings.gogNotConnected')}
                        </div>

                        {gogStatus?.databasePath && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>
                                {gogStatus.databasePath}
                            </p>
                        )}

                        <div className="steam-actions" style={{ marginTop: '12px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={isSyncing || !gogCanSync}
                                onClick={() => {
                                    if (!gogCanSync) {
                                        setGogLoginError(
                                            gogStatus?.error || t('settings.gogSyncRequired')
                                        )
                                        return
                                    }
                                    if (gogStatus?.error && (gogStatus.gamesAvailable ?? 0) === 0) {
                                        setGogLoginError(gogStatus.error)
                                        return
                                    }
                                    setGogLoginError(null)
                                    handleSave()
                                    onSyncGog()
                                }}
                            >
                                {isSyncing ? 'Syncing...' : t('settings.syncLibrary')}
                            </button>
                        </div>

                        {gogLoginError && <div className="login-error">{gogLoginError}</div>}

                        <p className="steam-login-hint" style={{ marginTop: '10px' }}>
                            {t('settings.gogLoginHint')}
                        </p>
                    </section>

                    {/* General Settings */}
                    <section className="settings-section">
                        <h3>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                            </svg>
                            {t('settings.appearance')}
                        </h3>

                        <div className="theme-selector">
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>{t('settings.theme')}</label>
                            <div className="theme-grid">
                                {THEME_OPTIONS.map(themeOpt => (
                                    <button
                                        type="button"
                                        key={themeOpt.id}
                                        className={`theme-card ${theme === themeOpt.id ? 'active' : ''}`}
                                        onClick={() => applyTheme(themeOpt.id)}
                                        style={{
                                            borderColor: theme === themeOpt.id ? 'var(--color-accent-primary)' : 'transparent'
                                        }}
                                    >
                                        <div
                                            className="theme-preview"
                                            style={{
                                                background: themeOpt.color,
                                                border: 'border' in themeOpt && themeOpt.border ? `1px solid ${themeOpt.border}` : 'none'
                                            }}
                                        />
                                        <span>{themeOpt.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group checkbox-group" style={{ marginTop: '1rem' }}>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={autoScrape}
                                    onChange={e => setAutoScrape(e.target.checked)}
                                />
                                {t('settings.autoScrape')}
                            </label>
                        </div>

                        <div className="form-group checkbox-group" style={{ marginTop: '0.5rem' }}>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={autoStart}
                                    onChange={async e => {
                                        const enabled = e.target.checked
                                        setAutoStart(enabled)
                                        // Set auto-start in the system
                                        if (window.electronAPI?.autoStartSet) {
                                            await window.electronAPI.autoStartSet(enabled)
                                        }
                                    }}
                                />
                                {t('settings.autoStart') || 'Start with Windows'}
                            </label>
                        </div>
                    </section>

                    <section className="settings-section">
                        <h3>⚡ {t('settings.gamingWindows')}</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                            {t('settings.gamingWindowsDesc')}
                        </p>

                        <div className="form-group checkbox-group">
                            <label>
                                <input type="checkbox" checked={preventDisplaySleep} onChange={e => setPreventDisplaySleep(e.target.checked)} />
                                {t('settings.preventDisplaySleep')}
                            </label>
                        </div>

                        <div className="form-group checkbox-group" style={{ marginTop: '0.5rem' }}>
                            <label>
                                <input type="checkbox" checked={preventSleepWhilePlaying} onChange={e => setPreventSleepWhilePlaying(e.target.checked)} />
                                {t('settings.preventSleepWhilePlaying')}
                            </label>
                        </div>

                        <div className="form-group checkbox-group" style={{ marginTop: '0.5rem' }}>
                            <label>
                                <input type="checkbox" checked={alwaysOnTop} onChange={e => setAlwaysOnTop(e.target.checked)} />
                                {t('settings.alwaysOnTop')}
                            </label>
                        </div>

                        <div className="form-group checkbox-group" style={{ marginTop: '0.5rem' }}>
                            <label>
                                <input type="checkbox" checked={rememberWindowBounds} onChange={e => setRememberWindowBounds(e.target.checked)} />
                                {t('settings.rememberWindowBounds')}
                            </label>
                        </div>

                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
                                {t('settings.closeButtonAction')}
                            </label>
                            <select
                                value={closeButtonAction}
                                onChange={e => setCloseButtonAction(e.target.value as CloseButtonAction)}
                                style={{ width: '100%', padding: '8px', borderRadius: '8px' }}
                            >
                                <option value="ask">{t('settings.closeAsk')}</option>
                                <option value="tray">{t('settings.closeTray')}</option>
                                <option value="quit">{t('settings.closeQuit')}</option>
                            </select>
                        </div>

                        <div className="form-group checkbox-group" style={{ marginTop: '0.75rem' }}>
                            <label>
                                <input type="checkbox" checked={globalHotkeyEnabled} onChange={e => setGlobalHotkeyEnabled(e.target.checked)} />
                                {t('settings.globalHotkey')}
                            </label>
                            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '6px 0 0 28px' }}>
                                {t('settings.globalHotkeyHint')}
                            </p>
                        </div>

                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
                                {t('settings.windowsPowerPlan')}
                            </label>
                            <select
                                value={windowsPowerPlan}
                                onChange={e => setWindowsPowerPlan(e.target.value as WindowsPowerPlan)}
                                style={{ width: '100%', padding: '8px', borderRadius: '8px' }}
                            >
                                <option value="leave">{t('settings.powerPlanLeave')}</option>
                                <option value="high">{t('settings.powerPlanHigh')}</option>
                                <option value="balanced">{t('settings.powerPlanBalanced')}</option>
                            </select>
                        </div>

                        <div className="form-group checkbox-group" style={{ marginTop: '0.5rem' }}>
                            <label>
                                <input type="checkbox" checked={restorePowerPlanOnExit} onChange={e => setRestorePowerPlanOnExit(e.target.checked)} />
                                {t('settings.restorePowerPlanOnExit')}
                            </label>
                        </div>
                    </section>

                    <section className="settings-section">
                        <h3>🎮 {t('settings.handheld')}</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                            {t('settings.handheldModeDesc')}
                        </p>

                        <ControllerStatus />

                        <TdpControl
                            enabled={tdpEnabled}
                            preset={tdpPreset}
                            customWatts={tdpCustomWatts}
                            ryzenAdjPath={ryzenAdjPath}
                            applyOnStart={tdpApplyOnStart}
                            applyOnGameLaunch={tdpApplyOnGameLaunch}
                            onEnabledChange={setTdpEnabled}
                            onPresetChange={setTdpPreset}
                            onCustomWattsChange={setTdpCustomWatts}
                            onRyzenAdjPathChange={setRyzenAdjPath}
                            onApplyOnStartChange={setTdpApplyOnStart}
                            onApplyOnGameLaunchChange={setTdpApplyOnGameLaunch}
                        />

                        <div className="form-group checkbox-group">
                            <label>
                                <input type="checkbox" checked={handheldMode} onChange={e => setHandheldMode(e.target.checked)} />
                                {t('settings.handheldMode')}
                            </label>
                        </div>

                        <div className="form-group checkbox-group" style={{ marginTop: '0.5rem' }}>
                            <label>
                                <input type="checkbox" checked={handheldAutoDetect} onChange={e => setHandheldAutoDetect(e.target.checked)} />
                                {t('settings.handheldAutoDetect')}
                            </label>
                        </div>

                        <div className="form-group checkbox-group" style={{ marginTop: '0.5rem' }}>
                            <label>
                                <input type="checkbox" checked={handheldStartFullscreen} onChange={e => setHandheldStartFullscreen(e.target.checked)} />
                                {t('settings.handheldStartFullscreen')}
                            </label>
                        </div>

                        <div className="form-group checkbox-group" style={{ marginTop: '0.5rem' }}>
                            <label>
                                <input type="checkbox" checked={minimizeOnPlay} onChange={e => setMinimizeOnPlay(e.target.checked)} />
                                {t('settings.minimizeOnPlay')}
                            </label>
                        </div>

                        <div className="form-group checkbox-group" style={{ marginTop: '0.5rem' }}>
                            <label>
                                <input type="checkbox" checked={lowEffects} onChange={e => setLowEffects(e.target.checked)} />
                                {t('settings.lowEffects')}
                            </label>
                        </div>

                        <div className="form-group checkbox-group" style={{ marginTop: '0.5rem' }}>
                            <label>
                                <input type="checkbox" checked={scrapeOnAcOnly} onChange={e => setScrapeOnAcOnly(e.target.checked)} />
                                {t('settings.scrapeOnAcOnly')}
                            </label>
                        </div>

                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
                                {t('settings.handheldDefaultFilter')}
                            </label>
                            <select
                                value={handheldDefaultFilter}
                                onChange={e => setHandheldDefaultFilter(e.target.value as HandheldDefaultFilter)}
                                style={{ width: '100%', padding: '8px', borderRadius: '8px' }}
                            >
                                <option value="installed">{t('sidebar.installed')}</option>
                                <option value="recent">{t('settings.filterRecent')}</option>
                                <option value="all">{t('sidebar.allGames')}</option>
                            </select>
                        </div>

                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
                                {t('settings.controllerLayout')}
                            </label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <button type="button" className={`btn ${controllerLayout === 'xbox' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setControllerLayout('xbox')}>
                                    {t('settings.layoutXbox')}
                                </button>
                                <button type="button" className={`btn ${controllerLayout === 'nintendo' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setControllerLayout('nintendo')}>
                                    {t('settings.layoutNintendo')}
                                </button>
                            </div>
                        </div>

                        <FullscreenControlsSettings
                            controls={fullscreenControls}
                            layout={controllerLayout}
                            onChange={setFullscreenControls}
                        />
                        <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ marginTop: '8px' }}
                            onClick={() => setFullscreenControls({ ...DEFAULT_FULLSCREEN_CONTROLS })}
                        >
                            {t('settings.resetFullscreenControls')}
                        </button>

                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
                                {t('settings.fullscreenTheme')}
                            </label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {(['xbox', 'playstation', 'nintendo'] as const).map(id => (
                                    <button key={id} type="button" className={`btn ${fullscreenTheme === id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFullscreenTheme(id)}>
                                        {id === 'xbox' ? t('settings.themeXbox') : id === 'playstation' ? t('settings.themePlaystation') : t('settings.themeNintendo')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
                                {t('settings.uiScale')}
                            </label>
                            <select value={uiScale} onChange={e => setUiScale(e.target.value as UiScale)} style={{ width: '100%', padding: '8px', borderRadius: '8px' }}>
                                <option value="100">100%</option>
                                <option value="115">115%</option>
                                <option value="125">125%</option>
                                <option value="150">150%</option>
                            </select>
                        </div>
                    </section>

                    {/* Collections Manager */}
                    <section className="settings-section">
                        <h3>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                            </svg>
                            {t('settings.collections')}
                        </h3>

                        <div className="collection-creator-wrapper">
                            <div className="emoji-picker">
                                {COLLECTION_ICONS.map(icon => (
                                    <button
                                        key={icon}
                                        className={`emoji-option ${selectedIcon === icon ? 'selected' : ''}`}
                                        onClick={() => setSelectedIcon(icon)}
                                        title={icon}
                                    >
                                        {icon}
                                    </button>
                                ))}
                            </div>

                            <div className="collection-creator">
                                <span className="selected-icon-preview">{selectedIcon}</span>
                                <input
                                    type="text"
                                    placeholder="New collection name..."
                                    value={newCollectionName}
                                    onChange={e => setNewCollectionName(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && newCollectionName.trim()) {
                                            const colors = ['#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#00bcd4', '#4caf50', '#ff9800']
                                            onAddCollection({
                                                id: `collection_${Date.now()}`,
                                                name: newCollectionName.trim(),
                                                icon: selectedIcon,
                                                color: colors[Math.floor(Math.random() * colors.length)],
                                                createdDate: new Date().toISOString()
                                            })
                                            setNewCollectionName('')
                                        }
                                    }}
                                />
                                <button
                                    className="btn btn-primary"
                                    onClick={() => {
                                        if (newCollectionName.trim()) {
                                            const colors = ['#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#00bcd4', '#4caf50', '#ff9800']
                                            onAddCollection({
                                                id: `collection_${Date.now()}`,
                                                name: newCollectionName.trim(),
                                                icon: selectedIcon,
                                                color: colors[Math.floor(Math.random() * colors.length)],
                                                createdDate: new Date().toISOString()
                                            })
                                            setNewCollectionName('')
                                        }
                                    }}
                                    disabled={!newCollectionName.trim()}
                                >
                                    {t('settings.addCollection')}
                                </button>
                            </div>
                        </div>

                        {(!collections || collections.length === 0) ? (
                            <div className="empty-collections">{t('settings.noCollections')}</div>
                        ) : (
                            <div className="collection-list">
                                {collections.map(c => (
                                    <div key={c.id} className="collection-item">
                                        <span className="collection-icon">{c.icon}</span>
                                        <span className="collection-name">{c.name}</span>
                                        <button
                                            className="collection-delete"
                                            onClick={() => onDeleteCollection(c.id)}
                                            title="Delete collection"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>

                <div className="settings-gamepad-hint">
                    <span><kbd>↑↓</kbd> {t('settings.navigateItems')}</span>
                    <span><kbd>←→</kbd> {t('settings.cycleSelect')}</span>
                    <span><kbd>{confirmLabel}</kbd> {t('settings.activateItem')}</span>
                    <span><kbd>Y</kbd> / <kbd>Start</kbd> {t('settings.save')}</span>
                    <span><kbd>{backLabel}</kbd> {t('settings.cancel')}</span>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>{t('settings.cancel')}</button>
                    <button className="btn btn-primary" onClick={handleSave}>{t('settings.save')}</button>
                </div>
            </div>
        </div>
    )
}

