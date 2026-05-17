import React from 'react'
import { Game, getPlatformInfo, ControllerLayout } from '../types/game'
import { PlatformIcon } from './PlatformIcon'
import { useGamepadInput } from '../hooks/useGamepadInput'

interface GameDetailProps {
    game: Game
    onClose: () => void
    onToggleFavorite: (game: Game) => void
    onPlay?: (game: Game) => void
    controllerLayout?: ControllerLayout
}

import { useLanguage } from '../context/LanguageContext'

export const GameDetail: React.FC<GameDetailProps> = ({
    game,
    onClose,
    onToggleFavorite,
    onPlay,
    controllerLayout = 'xbox'
}) => {
    const { t } = useLanguage()
    const platform = getPlatformInfo(game.platform)

    const handlePlay = async () => {
        if (onPlay) await onPlay(game)
    }

    const playLabel =
        game.isInstalled !== true &&
        (game.platform === 'steam' || game.platform === 'epic' || game.platform === 'gog')
            ? t('game.install')
            : t('game.playNow')

    useGamepadInput({
        layout: controllerLayout,
        onAction: (action) => {
            if (action === 'back') onClose()
            if (action === 'confirm') void handlePlay()
            if (action === 'x') onToggleFavorite(game)
        }
    })

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }

    return (
        <div className="modal-backdrop" onClick={handleBackdropClick}>
            <div className="game-detail">
                <div className="game-detail-hero">
                    {game.backgroundUrl || game.coverUrl ? (
                        <img
                            src={game.backgroundUrl || game.coverUrl}
                            alt={game.name}
                            className="game-detail-hero-image"
                        />
                    ) : (
                        <div
                            className="game-detail-hero-image"
                            style={{
                                background: `linear-gradient(135deg, ${platform.color} 0%, ${platform.accentColor} 100%)`
                            }}
                        />
                    )}
                    <div className="game-detail-hero-overlay" />

                    <button className="game-detail-close" onClick={onClose}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>

                    <div className="game-detail-header">
                        <div className="game-detail-cover">
                            {game.coverUrl ? (
                                <img src={game.coverUrl} alt={game.name} />
                            ) : (
                                <div
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        background: platform.color,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '3rem'
                                    }}
                                >
                                    <PlatformIcon platform={game.platform} width={48} height={48} />
                                </div>
                            )}
                        </div>

                        <div className="game-detail-info">
                            <h1 className="game-detail-title">{game.name}</h1>

                            <div className="game-detail-meta">
                                <span className="game-detail-tag" style={{ borderColor: platform.accentColor, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <PlatformIcon platform={game.platform} width={16} height={16} /> {platform.name}
                                </span>

                                {game.releaseDate && (
                                    <span className="game-detail-tag">
                                        📅 {new Date(game.releaseDate).getFullYear()}
                                    </span>
                                )}

                                {game.rating && (
                                    <span className="game-detail-tag">
                                        ⭐ {game.rating.toFixed(1)}
                                    </span>
                                )}

                                {game.genres?.slice(0, 3).map((genre) => (
                                    <span key={genre} className="game-detail-tag">
                                        {genre}
                                    </span>
                                ))}
                            </div>

                            <div className="game-detail-actions">
                                <button className="btn-play" onClick={handlePlay}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                    {playLabel}
                                </button>

                                <button
                                    className="btn-secondary"
                                    onClick={() => onToggleFavorite(game)}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill={game.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                    </svg>
                                    {game.isFavorite ? t('game.favorited') : t('game.addToFavorites')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="game-detail-body">
                    {game.description && (
                        <div className="game-detail-section">
                            <h3>{t('game.about')}</h3>
                            <p className="game-detail-description">{game.description}</p>
                        </div>
                    )}

                    {game.developer && (
                        <div className="game-detail-section">
                            <h3>{t('game.developer')}</h3>
                            <p className="game-detail-description">{game.developer}</p>
                        </div>
                    )}

                    {game.publisher && (
                        <div className="game-detail-section">
                            <h3>{t('game.publisher')}</h3>
                            <p className="game-detail-description">{game.publisher}</p>
                        </div>
                    )}

                    {game.screenshots && game.screenshots.length > 0 && (
                        <div className="game-detail-section">
                            <h3>{t('game.screenshots')}</h3>
                            <div className="game-detail-screenshots">
                                {game.screenshots.slice(0, 6).map((screenshot, index) => (
                                    <div key={index} className="game-detail-screenshot">
                                        <img src={screenshot} alt={`${game.name} screenshot ${index + 1}`} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="game-detail-section">
                        <h3>{t('game.installation')}</h3>
                        <p className="game-detail-description" style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                            {game.installPath}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
