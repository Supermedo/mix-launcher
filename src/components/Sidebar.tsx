import React from 'react'
import { Platform, PLATFORMS, Game, Collection } from '../types/game'
import { SIDEBAR_PLATFORM_IDS } from '../utils/sidebarNav'
import { PlatformIcon } from './PlatformIcon'
import type { SidebarNavId } from '../utils/sidebarNav'
import { useLanguage } from '../context/LanguageContext'

interface SidebarProps {
    games: Game[]
    collections: Collection[]
    selectedPlatform: Platform | 'all' | 'favorites' | 'installed' | 'hidden' | string
    searchQuery: string
    onPlatformChange: (platform: Platform | 'all' | 'favorites' | 'installed' | 'hidden' | string) => void
    onSearchChange: (query: string) => void
    onAddGame: () => void
    onScanGames: () => void
    onSettings: () => void
    onToggleFullscreen?: () => void
    handheldActive?: boolean
    onToggleHandheld?: () => void
    controllerFocusId?: SidebarNavId | null
    controllerNavActive?: boolean
}

export const Sidebar: React.FC<SidebarProps> = ({
    games,
    collections,
    selectedPlatform,
    searchQuery,
    onPlatformChange,
    onSearchChange,
    onAddGame,
    onScanGames,
    onSettings,
    onToggleFullscreen,
    handheldActive = false,
    onToggleHandheld,
    controllerFocusId,
    controllerNavActive = false
}) => {
    const { t } = useLanguage()

    const itemClass = (id: SidebarNavId) => {
        const active = selectedPlatform === id
        const focused = controllerNavActive && controllerFocusId === id
        return `platform-filter-item${active ? ' active' : ''}${focused ? ' controller-focus' : ''}`
    }

    const platformCounts = games.reduce((acc, game) => {
        acc[game.platform] = (acc[game.platform] || 0) + 1
        return acc
    }, {} as Record<Platform, number>)

    const favoriteCount = games.filter(g => g.isFavorite).length
    const hiddenCount = games.filter(g => g.isHidden).length

    React.useEffect(() => {
        if (!controllerNavActive) return
        const el = document.querySelector('.platform-filter-item.controller-focus')
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, [controllerFocusId, controllerNavActive])

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-search">
                    <svg className="sidebar-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        placeholder={t('sidebar.search')}
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>
            </div>

            <div className="platform-filters">
                <div className="platform-filter-group">
                    <div className="platform-filter-title">Library</div>

                    <div className={itemClass('all')} onClick={() => onPlatformChange('all')}>
                        <span className="platform-filter-icon">📚</span>
                        <span className="platform-filter-name">{t('sidebar.allGames')}</span>
                        <span className="platform-filter-count">{games.length}</span>
                    </div>

                    <div className={itemClass('installed')} onClick={() => onPlatformChange('installed')}>
                        <span className="platform-filter-icon">💾</span>
                        <span className="platform-filter-name">{t('sidebar.installed')}</span>
                        <span className="platform-filter-count">{games.filter(g => g.isInstalled !== false).length}</span>
                    </div>

                    <div className={itemClass('favorites')} onClick={() => onPlatformChange('favorites')}>
                        <span className="platform-filter-icon">❤️</span>
                        <span className="platform-filter-name">{t('sidebar.favorites')}</span>
                        <span className="platform-filter-count">{favoriteCount}</span>
                    </div>

                    <div className={itemClass('freegames')} onClick={() => onPlatformChange('freegames')}>
                        <span className="platform-filter-icon">🎁</span>
                        <span className="platform-filter-name">{t('sidebar.freeGames')}</span>
                        <span className="platform-filter-count" style={{ color: 'var(--color-success)' }}>NEW</span>
                    </div>

                    <div className={itemClass('cloudgaming')} onClick={() => onPlatformChange('cloudgaming')}>
                        <span className="platform-filter-icon">☁️</span>
                        <span className="platform-filter-name">{t('sidebar.cloudGaming')}</span>
                        <span className="platform-filter-count">{platformCounts.cloud || 0}</span>
                    </div>

                    <div className={itemClass('hidden')} onClick={() => onPlatformChange('hidden')}>
                        <span className="platform-filter-icon">🙈</span>
                        <span className="platform-filter-name">{t('sidebar.hidden')}</span>
                        <span className="platform-filter-count">{hiddenCount}</span>
                    </div>
                </div>

                <div className="platform-filter-group">
                    <div className="platform-filter-title">Platforms</div>

                    {SIDEBAR_PLATFORM_IDS.map((platformId) => {
                        const platform = PLATFORMS[platformId]
                        const count = platformCounts[platformId] || 0
                        return (
                            <div
                                key={platform.id}
                                className={itemClass(platform.id)}
                                onClick={() => onPlatformChange(platform.id)}
                            >
                                <span className="platform-filter-icon">
                                    <PlatformIcon platform={platform.id} />
                                </span>
                                <span className="platform-filter-name">{platform.name}</span>
                                <span className="platform-filter-count">{count}</span>
                            </div>
                        )
                    })}
                </div>

                {collections && collections.length > 0 && (
                    <div className="platform-filter-group">
                        <div className="platform-filter-title">{t('sidebar.collections')}</div>
                        {collections.map((collection) => {
                            const count = games.filter(g =>
                                g.collections && g.collections.includes(collection.id)
                            ).length
                            return (
                                <div
                                    key={collection.id}
                                    className={itemClass(collection.id)}
                                    onClick={() => onPlatformChange(collection.id)}
                                >
                                    <span className="platform-filter-icon">{collection.icon}</span>
                                    <span className="platform-filter-name">{collection.name}</span>
                                    <span className="platform-filter-count">{count}</span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            <div className="sidebar-footer">
                {onToggleFullscreen && (
                    <button
                        className="sidebar-btn"
                        onClick={onToggleFullscreen}
                        style={{
                            background: 'linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary))',
                            color: 'white',
                            border: 'none',
                            marginTop: '0px',
                            marginBottom: '16px'
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M1.5 1h4V2h-3v3h-1V1zm13 4V2h-3V1h4v4h-1zm-13 6v3h3v1h-4v-4h1zm13 3v-3h1v4h-4v-1h3z" />
                            <rect x="5" y="5" width="6" height="6" rx="1" fill="currentColor" fillOpacity="0.5" />
                        </svg>
                        {t('sidebar.bigPicture')}
                    </button>
                )}

                {onToggleHandheld && (
                    <button
                        type="button"
                        className={`sidebar-btn sidebar-btn-handheld${handheldActive ? ' active' : ''}`}
                        onClick={onToggleHandheld}
                        title={t('sidebar.handheldMode')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="4" y="2" width="16" height="20" rx="3" />
                            <circle cx="12" cy="18" r="1" fill="currentColor" />
                        </svg>
                        {t('sidebar.handheldMode')}
                        <span style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.7 }}>
                            {handheldActive ? t('sidebar.handheldOn') : t('sidebar.handheldOff')}
                        </span>
                    </button>
                )}

                <button className="sidebar-btn" onClick={onScanGames}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                    </svg>
                    {t('sidebar.scan')}
                </button>

                <button className="sidebar-btn" onClick={onAddGame} style={{ marginTop: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14m-7-7h14" />
                    </svg>
                    {t('sidebar.addGame')}
                </button>

                <button className="sidebar-btn settings-btn" onClick={onSettings} style={{ marginTop: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                    </svg>
                    {t('sidebar.settings')}
                </button>

                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: '500' }}>
                        Made by Mohammed Albarghouhi
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginTop: '4px' }}>
                        Mohmmad.pod@gmail.com
                    </div>
                </div>
            </div>
        </aside>
    )
}
