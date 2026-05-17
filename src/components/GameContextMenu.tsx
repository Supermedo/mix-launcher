import React, { useRef, useEffect } from 'react'
import { Game, Collection } from '../types/game'

interface GameContextMenuProps {
    game: Game
    collections: Collection[]
    position: { x: number, y: number }
    onClose: () => void
    onHide: (game: Game) => void
    onUnhide: (game: Game) => void
    onAddToCollection: (game: Game, collectionId: string) => void
    onRemoveFromCollection: (game: Game, collectionId: string) => void
    onSetCustomCover: (game: Game) => void
    onRemoveCustomCover: (game: Game) => void
}

import { useLanguage } from '../context/LanguageContext'

export const GameContextMenu: React.FC<GameContextMenuProps> = ({
    game,
    collections,
    position,
    onClose,
    onHide,
    onUnhide,
    onAddToCollection,
    onRemoveFromCollection,
    onSetCustomCover,
    onRemoveCustomCover
}) => {
    const { t } = useLanguage()
    const menuRef = useRef<HTMLDivElement>(null)

    // Close on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose()
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [onClose])

    // Adjust position to keep menu in viewport
    const adjustedPosition = {
        x: Math.min(position.x, window.innerWidth - 220),
        y: Math.min(position.y, window.innerHeight - 300)
    }

    const gameCollections = game.collections || []

    return (
        <div
            ref={menuRef}
            className="context-menu"
            style={{
                left: adjustedPosition.x,
                top: adjustedPosition.y
            }}
        >
            <div className="context-menu-header">{game.name}</div>

            {/* Hide/Unhide */}
            {game.isHidden ? (
                <button className="context-menu-item" onClick={() => onUnhide(game)}>
                    <span>👁️</span> {t('game.unhide')}
                </button>
            ) : (
                <button className="context-menu-item" onClick={() => onHide(game)}>
                    <span>🙈</span> {t('game.hide')}
                </button>
            )}

            <div className="context-menu-separator" />

            {/* Custom Cover */}
            <button className="context-menu-item" onClick={() => onSetCustomCover(game)}>
                <span>🖼️</span> {t('game.setCover')}
            </button>
            {game.customCoverUrl && (
                <button className="context-menu-item" onClick={() => onRemoveCustomCover(game)}>
                    <span>🗑️</span> {t('game.removeCover')}
                </button>
            )}

            <div className="context-menu-separator" />

            {/* Collections */}
            <div className="context-menu-label">{t('sidebar.collections')}</div>
            {(!collections || collections.length === 0) ? (
                <div className="context-menu-empty">{t('game.noCollections')}</div>
            ) : (
                collections.map(collection => {
                    const isInCollection = gameCollections.includes(collection.id)
                    return (
                        <button
                            key={collection.id}
                            className={`context-menu-item ${isInCollection ? 'active' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation()
                                console.log('Collection clicked:', collection.name, 'isInCollection:', isInCollection)
                                if (isInCollection) {
                                    onRemoveFromCollection(game, collection.id)
                                } else {
                                    onAddToCollection(game, collection.id)
                                }
                            }}
                        >
                            <span>{collection.icon}</span>
                            {collection.name}
                            {isInCollection && <span className="check">✓</span>}
                        </button>
                    )
                })
            )}
        </div>
    )
}
