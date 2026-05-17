import React, { useState, useEffect, useCallback, useRef } from 'react'
import { FreeGame, FreeGamesFilter, GIVEAWAY_PLATFORMS, GIVEAWAY_TYPES, GiveawayPlatform, GiveawayType } from '../types/freeGame'
import { fetchFreeGames, fetchGiveawayWorth } from '../services/gamerPowerApi'
import { FreeGameCard } from './FreeGameCard'
import { useLanguage } from '../context/LanguageContext'
import { useGamepadInput } from '../hooks/useGamepadInput'
import type { ControllerLayout } from '../types/game'

interface FreeGamesViewProps {
    onOpenUrl: (url: string) => void
    gamepadEnabled?: boolean
    controllerLayout?: ControllerLayout
    onBack?: () => void
}

export const FreeGamesView: React.FC<FreeGamesViewProps> = ({
    onOpenUrl,
    gamepadEnabled = false,
    controllerLayout = 'xbox',
    onBack
}) => {
    const { t } = useLanguage()
    const [games, setGames] = useState<FreeGame[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [totalWorth, setTotalWorth] = useState<string | null>(null)
    const [filter, setFilter] = useState<FreeGamesFilter>({
        platform: 'all',
        type: 'all',
        sortBy: 'date'
    })
    const [focusedGameIndex, setFocusedGameIndex] = useState(0)
    const [platformPillIndex, setPlatformPillIndex] = useState(0)
    const [focusArea, setFocusArea] = useState<'filters' | 'games'>('games')
    const gridRef = useRef<HTMLDivElement>(null)

    const loadGames = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const options: { platform?: GiveawayPlatform; type?: GiveawayType; sortBy?: 'date' | 'value' | 'popularity' } = {
                sortBy: filter.sortBy
            }

            if (filter.platform !== 'all') {
                options.platform = filter.platform
            }
            if (filter.type !== 'all') {
                options.type = filter.type
            }

            const data = await fetchFreeGames(options)
            setGames(data)
            setFocusedGameIndex(0)
        } catch (err) {
            setError(t('freeGames.error'))
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [filter, t])

    const loadWorth = useCallback(async () => {
        try {
            const worth = await fetchGiveawayWorth()
            if (worth) {
                setTotalWorth(worth.worth_estimation_usd)
            }
        } catch (err) {
            console.error('Failed to load worth:', err)
        }
    }, [])

    useEffect(() => {
        loadGames()
        loadWorth()
    }, [loadGames, loadWorth])

    useEffect(() => {
        if (focusArea !== 'games' || !gridRef.current) return
        const cards = gridRef.current.querySelectorAll('.free-games-card-wrap')
        const card = cards[focusedGameIndex] as HTMLElement | undefined
        card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, [focusedGameIndex, focusArea, games.length])

    const handleClaim = (game: FreeGame) => {
        onOpenUrl(game.open_giveaway_url)
    }

    const handleRefresh = () => {
        loadGames()
        loadWorth()
    }

    useGamepadInput({
        enabled: gamepadEnabled && !loading && games.length > 0,
        layout: controllerLayout,
        onNavigate: (direction) => {
            if (focusArea === 'filters') {
                if (direction === 'left' || direction === 'up') {
                    const idx = Math.max(0, platformPillIndex - 1)
                    setPlatformPillIndex(idx)
                    setFilter(f => ({ ...f, platform: GIVEAWAY_PLATFORMS[idx].id }))
                } else if (direction === 'right' || direction === 'down') {
                    const idx = Math.min(GIVEAWAY_PLATFORMS.length - 1, platformPillIndex + 1)
                    setPlatformPillIndex(idx)
                    setFilter(f => ({ ...f, platform: GIVEAWAY_PLATFORMS[idx].id }))
                }
                return
            }

            const cols = Math.max(1, Math.floor((gridRef.current?.offsetWidth || 800) / 220))
            if (direction === 'left') {
                setFocusedGameIndex(i => Math.max(0, i - 1))
            } else if (direction === 'right') {
                setFocusedGameIndex(i => Math.min(games.length - 1, i + 1))
            } else if (direction === 'up') {
                setFocusedGameIndex(i => Math.max(0, i - cols))
            } else if (direction === 'down') {
                setFocusedGameIndex(i => Math.min(games.length - 1, i + cols))
            }
        },
        onAction: (action) => {
            if (action === 'back') {
                onBack?.()
                return
            }
            if (action === 'confirm' && games[focusedGameIndex]) {
                handleClaim(games[focusedGameIndex])
            }
            if (action === 'lb' || action === 'menu') {
                setFocusArea('filters')
            }
            if (action === 'rb') {
                setFocusArea('games')
            }
        }
    })

    return (
        <div className="free-games-view">
            <div className="free-games-header">
                <div className="free-games-title-row">
                    <h1 className="content-title">🎁 {t('sidebar.freeGames')}</h1>
                    {totalWorth && (
                        <div className="total-worth-badge">
                            {t('freeGames.totalValue')} <span className="worth-value">{totalWorth}</span>
                        </div>
                    )}
                </div>

                <div className="free-games-actions">
                    <button className="refresh-btn" onClick={handleRefresh} disabled={loading}>
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className={loading ? 'spinning' : ''}
                        >
                            <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                        </svg>
                        {t('freeGames.refresh')}
                    </button>
                </div>
            </div>

            <div className={`free-games-filters${focusArea === 'filters' ? ' focused' : ''}`}>
                <div className="filter-group">
                    <label>{t('freeGames.platform')}</label>
                    <div className="filter-pills">
                        {GIVEAWAY_PLATFORMS.map((p, idx) => (
                            <button
                                key={p.id}
                                className={`filter-pill ${filter.platform === p.id ? 'active' : ''}${focusArea === 'filters' && platformPillIndex === idx ? ' controller-focus' : ''}`}
                                onClick={() => {
                                    setPlatformPillIndex(idx)
                                    setFilter(f => ({ ...f, platform: p.id }))
                                }}
                            >
                                <span className="pill-icon">{p.icon}</span>
                                {p.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="filter-group">
                    <label>{t('freeGames.type')}</label>
                    <div className="filter-pills">
                        {GIVEAWAY_TYPES.map(typeOpt => (
                            <button
                                key={typeOpt.id}
                                className={`filter-pill ${filter.type === typeOpt.id ? 'active' : ''}`}
                                onClick={() => setFilter(f => ({ ...f, type: typeOpt.id }))}
                            >
                                {typeOpt.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="filter-group">
                    <label>{t('freeGames.sortBy')}</label>
                    <select
                        className="filter-select"
                        value={filter.sortBy}
                        onChange={(e) => setFilter(f => ({ ...f, sortBy: e.target.value as 'date' | 'value' | 'popularity' }))}
                    >
                        <option value="date">{t('freeGames.sortNewest')}</option>
                        <option value="value">{t('freeGames.sortValue')}</option>
                        <option value="popularity">{t('freeGames.sortPopular')}</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="free-games-loading">
                    <div className="loading-spinner" />
                    <p>{t('freeGames.loading')}</p>
                </div>
            ) : error ? (
                <div className="free-games-error">
                    <p>⚠️ {error}</p>
                    <button onClick={handleRefresh}>{t('freeGames.tryAgain')}</button>
                </div>
            ) : games.length === 0 ? (
                <div className="free-games-empty">
                    <p>{t('freeGames.noGames')}</p>
                </div>
            ) : (
                <>
                    <div className="free-games-count">
                        {t('freeGames.available').replace('{count}', games.length.toString())}
                    </div>
                    <div
                        ref={gridRef}
                        className={`free-games-grid${focusArea === 'games' ? ' focused' : ''}`}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                            gap: '24px',
                            padding: '24px'
                        }}
                    >
                        {games.map((game, index) => (
                            <div
                                key={game.id}
                                className={`free-games-card-wrap${focusArea === 'games' && focusedGameIndex === index ? ' free-game-card-focus' : ''}`}
                            >
                                <FreeGameCard
                                    game={game}
                                    onClaim={handleClaim}
                                />
                            </div>
                        ))}
                    </div>
                </>
            )}

            <div className="free-games-attribution">
                {t('freeGames.poweredBy')} <a href="https://www.gamerpower.com" target="_blank" rel="noopener noreferrer">GamerPower</a>
            </div>
        </div>
    )
}
