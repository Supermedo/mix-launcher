import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Game, Settings } from '../types/game'
import { GameCard } from './GameCard'
import { useGamepadInput } from '../hooks/useGamepadInput'
import type { ControllerLayout } from '../types/game'
import { useLanguage } from '../context/LanguageContext'

interface GameGridProps {
    games: Game[]
    gridSize: Settings['gridSize']
    controllerLayout?: ControllerLayout
    gamepadEnabled?: boolean
    touchToPlay?: boolean
    onFocusSidebar?: () => void
    onSelectGame: (game: Game) => void
    onPlayGame: (game: Game) => void
    onToggleFavorite: (game: Game) => void
    onContextMenu?: (game: Game, position: { x: number, y: number }) => void
}

const VIRTUALIZE_THRESHOLD = 96

function rowHeightForGridSize(gridSize: Settings['gridSize']): number {
    if (gridSize === 'small') return 224
    if (gridSize === 'large') return 397
    return 291
}

export const GameGrid: React.FC<GameGridProps> = ({
    games,
    gridSize,
    controllerLayout = 'xbox',
    gamepadEnabled = true,
    touchToPlay = false,
    onFocusSidebar,
    onSelectGame,
    onPlayGame,
    onToggleFavorite,
    onContextMenu
}) => {
    const { t } = useLanguage()
    const gridRef = useRef<HTMLDivElement>(null)
    const [focusedIndex, setFocusedIndex] = useState(0)
    const [columnCount, setColumnCount] = useState(5)
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 72 })

    const useVirtual = games.length > VIRTUALIZE_THRESHOLD
    const rowHeight = rowHeightForGridSize(gridSize)

    const getGridColumns = useCallback((): number => {
        if (!gridRef.current) return 5
        const containerWidth = gridRef.current.offsetWidth
        const itemWidth = gridSize === 'small' ? 150 : gridSize === 'large' ? 280 : 200
        const gap = 24
        return Math.max(1, Math.floor(containerWidth / (itemWidth + gap)))
    }, [gridSize])

    const updateVisibleRange = useCallback(() => {
        const el = gridRef.current
        if (!el || !useVirtual) return
        const cols = getGridColumns()
        setColumnCount(cols)
        const top = el.scrollTop
        const viewH = el.clientHeight
        const startRow = Math.max(0, Math.floor(top / rowHeight) - 1)
        const visibleRows = Math.ceil(viewH / rowHeight) + 3
        const start = Math.min(games.length, startRow * cols)
        const end = Math.min(games.length, start + visibleRows * cols)
        setVisibleRange(prev =>
            prev.start === start && prev.end === end ? prev : { start, end }
        )
    }, [games.length, getGridColumns, rowHeight, useVirtual])

    useEffect(() => {
        const el = gridRef.current
        if (!el) return
        updateVisibleRange()
        el.addEventListener('scroll', updateVisibleRange, { passive: true })
        const ro = new ResizeObserver(() => updateVisibleRange())
        ro.observe(el)
        return () => {
            el.removeEventListener('scroll', updateVisibleRange)
            ro.disconnect()
        }
    }, [updateVisibleRange])

    useEffect(() => {
        setFocusedIndex(0)
        setVisibleRange({ start: 0, end: Math.min(games.length, 72) })
    }, [games.length, gridSize])

    const navigate = useCallback((
        direction: 'up' | 'down' | 'left' | 'right',
        gridColumns: number,
        totalItems: number
    ) => {
        setFocusedIndex(prev => {
            let next = prev
            switch (direction) {
                case 'left': next = prev - 1; break
                case 'right': next = prev + 1; break
                case 'up': next = prev - gridColumns; break
                case 'down': next = prev + gridColumns; break
            }
            if (next < 0) next = 0
            if (next >= totalItems) next = totalItems - 1
            return next
        })
    }, [])

    const { connected } = useGamepadInput({
        enabled: gamepadEnabled,
        layout: controllerLayout,
        onNavigate: (direction) => {
            navigate(direction, getGridColumns(), games.length)
        },
        onAction: (action) => {
            const game = games[focusedIndex]
            if (!game) return
            if (action === 'confirm') onPlayGame(game)
            if (action === 'y') onSelectGame(game)
            if (action === 'x') onToggleFavorite(game)
            if (action === 'lb') onFocusSidebar?.()
            if (action === 'menu' && onContextMenu) {
                onContextMenu(game, { x: window.innerWidth / 2, y: window.innerHeight / 2 })
            }
        }
    })

    useEffect(() => {
        if (useVirtual) {
            setVisibleRange(prev => {
                if (focusedIndex >= prev.start && focusedIndex < prev.end) return prev
                const cols = columnCount || getGridColumns()
                const row = Math.floor(focusedIndex / cols)
                const startRow = Math.max(0, row - 1)
                const visibleRows = 6
                const start = Math.min(games.length, startRow * cols)
                const end = Math.min(games.length, start + visibleRows * cols)
                return { start, end }
            })
        }
        const focused = document.querySelector('.game-card.controller-focus')
        if (focused) {
            focused.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
    }, [focusedIndex, useVirtual, columnCount, games.length, getGridColumns])

    const { paddingTop, paddingBottom, visibleGames } = useMemo(() => {
        if (!useVirtual) {
            return { paddingTop: 0, paddingBottom: 0, visibleGames: games }
        }
        const cols = columnCount || 1
        const startRow = Math.floor(visibleRange.start / cols)
        const endRow = Math.ceil(visibleRange.end / cols)
        const totalRows = Math.ceil(games.length / cols)
        return {
            paddingTop: startRow * rowHeight,
            paddingBottom: Math.max(0, (totalRows - endRow) * rowHeight),
            visibleGames: games.slice(visibleRange.start, visibleRange.end)
        }
    }, [games, useVirtual, visibleRange, columnCount, rowHeight])

    if (games.length === 0) {
        return (
            <div className="empty-state">
                <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3>{t('gameGrid.noGames')}</h3>
                <p>{t('gameGrid.noGamesDesc')}</p>
            </div>
        )
    }

    return (
        <div className="game-grid-container" ref={gridRef}>
            <div className={`game-grid size-${gridSize}`}>
                {useVirtual && paddingTop > 0 ? (
                    <div aria-hidden className="game-grid-virtual-spacer" style={{ height: paddingTop }} />
                ) : null}
                {visibleGames.map((game, localIndex) => {
                    const index = useVirtual ? visibleRange.start + localIndex : localIndex
                    return (
                        <GameCard
                            key={game.id}
                            game={game}
                            isFocused={connected && focusedIndex === index}
                            touchToPlay={touchToPlay}
                            onSelect={onSelectGame}
                            onPlay={onPlayGame}
                            onToggleFavorite={onToggleFavorite}
                            onContextMenu={onContextMenu}
                        />
                    )
                })}
                {useVirtual && paddingBottom > 0 ? (
                    <div aria-hidden className="game-grid-virtual-spacer" style={{ height: paddingBottom }} />
                ) : null}
            </div>
        </div>
    )
}
