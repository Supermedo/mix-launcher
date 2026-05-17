import React, { useState } from 'react'
import { Game } from '../types/game'
import { addManualGame } from '../services/platforms/manual'
import { scrapeGameMetadata } from '../services/scraper'

interface AddGameModalProps {
    onClose: () => void
    onGameAdded: (game: Game) => void
}

import { useLanguage } from '../context/LanguageContext'
import { useGamepadInput } from '../hooks/useGamepadInput'

export const AddGameModal: React.FC<AddGameModalProps> = ({
    onClose,
    onGameAdded
}) => {
    const { t } = useLanguage()

    const [name, setName] = useState('')
    const [executablePath, setExecutablePath] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const modalRef = React.useRef<HTMLDivElement>(null)
    const [focusIndex, setFocusIndex] = React.useState(0)

    const getFocusables = React.useCallback(() => {
        if (!modalRef.current) return []
        return Array.from(
            modalRef.current.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input:not([disabled])'
            )
        ).filter(el => el.offsetParent !== null)
    }, [])

    React.useEffect(() => {
        const items = getFocusables()
        items.forEach(el => el.classList.remove('settings-item-focus'))
        const el = items[focusIndex]
        if (el) {
            el.classList.add('settings-item-focus')
            el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
    }, [focusIndex, getFocusables, name, executablePath, isLoading])

    useGamepadInput({
        exclusive: true,
        onNavigate: direction => {
            const items = getFocusables()
            if (items.length === 0) return
            if (direction === 'down') setFocusIndex(i => Math.min(items.length - 1, i + 1))
            if (direction === 'up') setFocusIndex(i => Math.max(0, i - 1))
        },
        onAction: action => {
            if (action === 'back') onClose()
            if (action === 'confirm') {
                const el = getFocusables()[focusIndex]
                el?.click()
            }
        }
    })

    const handleBrowse = async () => {
        const path = await window.electronAPI.openFileDialog()
        if (path) {
            setExecutablePath(path)

            // Try to extract game name from path
            if (!name) {
                const fileName = path.split('\\').pop()?.replace('.exe', '') || ''
                setName(fileName)
            }
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!name.trim()) {
            setError(t('addGame.errorName'))
            return
        }

        if (!executablePath.trim()) {
            setError(t('addGame.errorPath'))
            return
        }

        setIsLoading(true)
        setError('')

        try {
            // Create the game entry
            const game = await addManualGame(name.trim(), executablePath.trim())

            // Try to scrape metadata
            const metadata = await scrapeGameMetadata(game)
            const enrichedGame = { ...game, ...metadata }

            onGameAdded(enrichedGame)
            onClose()
        } catch (err) {
            setError(t('addGame.errorGeneric'))
            console.error(err)
        } finally {
            setIsLoading(false)
        }
    }

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }

    return (
        <div className="modal-backdrop" onClick={handleBackdropClick}>
            <div ref={modalRef} className="add-game-modal" role="dialog" aria-modal="true">
                <div className="add-game-header">
                    <h2>{t('addGame.title')}</h2>
                    <button className="game-detail-close" onClick={onClose} style={{ position: 'static' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="add-game-body">
                        {error && (
                            <div style={{
                                padding: '12px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '8px',
                                color: '#ef4444',
                                marginBottom: '16px',
                                fontSize: '0.875rem'
                            }}>
                                {error}
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">{t('addGame.nameLabel')}</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder={t('addGame.namePlaceholder')}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">{t('addGame.pathLabel')}</label>
                            <div className="form-file-input">
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder={t('addGame.pathPlaceholder')}
                                    value={executablePath}
                                    onChange={(e) => setExecutablePath(e.target.value)}
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    className="form-file-btn"
                                    onClick={handleBrowse}
                                    disabled={isLoading}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                            {t('addGame.hint')}
                        </p>
                    </div>

                    <div className="add-game-footer">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            {t('settings.cancel')}
                        </button>
                        <button
                            type="submit"
                            className="btn-play"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <div className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                                    {t('addGame.adding')}
                                </>
                            ) : (
                                <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 5v14m-7-7h14" />
                                    </svg>
                                    {t('addGame.submit')}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
