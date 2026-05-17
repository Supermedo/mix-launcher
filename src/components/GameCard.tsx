import React, { useState } from 'react'
import { Game, getPlatformInfo } from '../types/game'
import { PlatformIcon } from './PlatformIcon'
import { useDoubleTap } from '../hooks/useDoubleTap'

interface GameCardProps {
    game: Game
    isFocused?: boolean
    /** Touch: double-tap launches; single tap opens details. */
    touchToPlay?: boolean
    onSelect: (game: Game) => void
    onPlay: (game: Game) => void
    onToggleFavorite: (game: Game) => void
    onContextMenu?: (game: Game, position: { x: number, y: number }) => void
}

import { useLanguage } from '../context/LanguageContext'

export const GameCard: React.FC<GameCardProps> = ({
    game,
    isFocused,
    touchToPlay = false,
    onSelect,
    onPlay,
    onToggleFavorite,
    onContextMenu
}) => {
    const { t } = useLanguage()
    const platform = getPlatformInfo(game.platform)
    const [imageError, setImageError] = useState(false)

    const handleCardActivate = useDoubleTap(
        () => onSelect(game),
        () => onPlay(game)
    )

    const handlePlayClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        onPlay(game)
    }

    const handleFavoriteClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        onToggleFavorite(game)
    }

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (onContextMenu) {
            onContextMenu(game, { x: e.clientX, y: e.clientY })
        }
    }

    // Generate placeholder gradient for games without cover art
    const getPlaceholderStyle = (): React.CSSProperties => {
        const hash = game.name.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0)
            return a & a
        }, 0)

        const hue = Math.abs(hash) % 360

        return {
            background: `linear-gradient(135deg, hsl(${hue}, 60%, 30%) 0%, hsl(${(hue + 60) % 360}, 50%, 20%) 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '3rem',
            flexDirection: 'column',
            gap: '0.5rem'
        }
    }

    // Use customCoverUrl first, then coverUrl, fallback to placeholder
    const coverImage = game.customCoverUrl || game.coverUrl
    const showPlaceholder = !coverImage || imageError

    return (
        <div
            className={`game-card ${isFocused ? 'controller-focus' : ''} ${game.isHidden ? 'hidden-game' : ''}${touchToPlay ? ' touch-to-play' : ''}`}
            onClick={touchToPlay ? undefined : () => onSelect(game)}
            onTouchEnd={touchToPlay ? (e) => { e.preventDefault(); handleCardActivate() } : undefined}
            onContextMenu={handleContextMenu}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter') onSelect(game)
            }}
        >
            {!showPlaceholder ? (
                <img
                    src={coverImage}
                    alt={game.name}
                    className="game-card-image"
                    loading="lazy"
                    onError={() => setImageError(true)}
                />
            ) : (
                <div className="game-card-image game-card-placeholder" style={getPlaceholderStyle()}>
                    <PlatformIcon platform={game.platform} width={48} height={48} />
                    <span style={{ fontSize: '0.7rem', padding: '0 0.5rem', textAlign: 'center', opacity: 0.8 }}>
                        {game.name.slice(0, 20)}{game.name.length > 20 ? '...' : ''}
                    </span>
                </div>
            )}

            <div className="game-card-overlay" />

            <button
                className={`game-card-favorite ${game.isFavorite ? 'active' : ''}`}
                onClick={handleFavoriteClick}
                title={game.isFavorite ? t('game.removeFromFavorites') : t('game.addToFavorites')}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={game.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
            </button>

            <button className="game-card-play" onClick={handlePlayClick} title={t('game.play')}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                </svg>
            </button>

            <div className="game-card-content">
                <div className="game-card-title">{game.name}</div>
                <div className={`game-card-platform platform-${game.platform}`}>
                    <PlatformIcon platform={game.platform} width={14} height={14} />
                    <span>{platform.name}</span>
                </div>
            </div>
        </div>
    )
}
