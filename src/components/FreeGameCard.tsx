import React from 'react'
import { FreeGame } from '../types/freeGame'
import { getDaysRemaining, isExpiringSoon, formatWorth, parsePlatforms } from '../services/gamerPowerApi'

interface FreeGameCardProps {
    game: FreeGame
    onClaim: (game: FreeGame) => void
}

import { useLanguage } from '../context/LanguageContext'

export const FreeGameCard: React.FC<FreeGameCardProps> = ({ game, onClaim }) => {
    const { t } = useLanguage()
    const daysRemaining = getDaysRemaining(game.end_date)
    const expiringSoon = isExpiringSoon(game.end_date)
    const worth = formatWorth(game.worth)
    const platforms = parsePlatforms(game.platforms)

    // Map platform names to colors
    const getPlatformColor = (platform: string): string => {
        const p = platform.toLowerCase()
        if (p.includes('steam')) return '#66c0f4'
        if (p.includes('epic')) return '#333' // Epic dark
        if (p.includes('gog')) return '#ab47bc'
        if (p.includes('ubisoft') || p.includes('uplay')) return '#0070ff'
        if (p.includes('origin') || p.includes('ea')) return '#ff4747'
        if (p.includes('itch')) return '#fa5c5c'
        if (p.includes('android')) return '#3ddc84'
        if (p.includes('ios')) return '#000'
        return '#4caf50'
    }

    return (
        <div
            className="game-card"
            onClick={() => onClaim(game)}
            style={{
                border: expiringSoon ? '2px solid #f59e0b' : undefined,
                margin: '10px',
                width: '100%',
                backgroundColor: '#1a1f2e',
                borderRadius: '12px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                transition: 'transform 0.2s',
                minHeight: '300px', // Restore standard height
                position: 'relative'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1)'
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            }}
        >
            {/* Image Section - Fixed 16:9 aspect ratio at top */}
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', flexShrink: 0 }}>
                <img
                    src={game.thumbnail}
                    alt={game.title}
                    loading="lazy"
                    style={{
                        objectFit: 'cover',
                        width: '100%',
                        height: '100%',
                        display: 'block'
                    }}
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = game.image
                    }}
                />

                {/* Overlay Badges */}
                <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px' }}>
                    {expiringSoon && daysRemaining !== null && (
                        <span style={{
                            background: '#f59e0b', color: '#000', fontSize: '10px',
                            padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold'
                        }}>
                            {daysRemaining === 0 ? t('freeGames.lastDay') : `${daysRemaining}d`}
                        </span>
                    )}
                </div>
            </div>

            {/* Content Section */}
            <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Title */}
                <h3 style={{
                    margin: 0, fontSize: '14px', fontWeight: '600', color: '#fff',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    lineHeight: '1.4',
                    height: '40px' // Fixed height for title area
                }}>
                    {game.title}
                </h3>

                {/* Badges Row */}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', minHeight: '20px' }}>
                    {/* Worth Badge */}
                    <span style={{
                        fontSize: '10px', color: '#4ade80',
                        background: 'rgba(74, 222, 128, 0.1)',
                        padding: '2px 6px', borderRadius: '4px', fontWeight: '600',
                        display: 'inline-flex', alignItems: 'center'
                    }}>
                        {worth}
                    </span>
                    {/* Platform Badges */}
                    {platforms.slice(0, 3).map((p, i) => (
                        <span key={i} style={{
                            fontSize: '10px', color: '#fff',
                            background: getPlatformColor(p),
                            padding: '2px 6px', borderRadius: '4px', fontWeight: '600',
                            display: 'inline-flex', alignItems: 'center'
                        }}>
                            {p}
                        </span>
                    ))}
                    {platforms.length > 3 && (
                        <span style={{
                            fontSize: '10px', color: '#94a3b8',
                            background: 'rgba(148, 163, 184, 0.1)',
                            padding: '2px 6px', borderRadius: '4px'
                        }}>+{platforms.length - 3}</span>
                    )}
                </div>

                {/* Filter Type Badge (Game/DLC) */}
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                    {game.type}
                </div>

                {/* Claim Button */}
                <div style={{ marginTop: 'auto', paddingTop: '4px' }}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onClaim(game)
                        }}
                        style={{
                            width: '100%',
                            padding: '8px',
                            background: 'linear-gradient(to right, #6366f1, #8b5cf6)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        {t('freeGames.claim')}
                    </button>
                </div>
            </div>
        </div>
    )
}
