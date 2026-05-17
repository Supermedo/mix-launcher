import React from 'react'
import type { ControllerLayout } from '../types/game'
import { useLanguage } from '../context/LanguageContext'

interface GamepadHintBarProps {
    layout: ControllerLayout
    visible: boolean
    focusArea: 'sidebar' | 'grid'
    touchHint?: boolean
}

export const GamepadHintBar: React.FC<GamepadHintBarProps> = ({ layout, visible, focusArea, touchHint }) => {
    const { t } = useLanguage()
    if (!visible) return null

    const confirm = layout === 'nintendo' ? 'B' : 'A'
    const back = layout === 'nintendo' ? 'A' : 'B'

    return (
        <div className="gamepad-hint-bar" role="status" aria-live="polite">
            <span className="gamepad-hint-focus">{focusArea === 'sidebar' ? 'Sidebar' : 'Library'}</span>
            <span className="gamepad-hint-sep">·</span>
            <span><kbd>{confirm}</kbd> Play</span>
            <span><kbd>Y</kbd> Details</span>
            <span><kbd>X</kbd> Favorite</span>
            <span><kbd>{back}</kbd> Back</span>
            <span><kbd>LB</kbd> Sidebar</span>
            <span><kbd>RB</kbd> Games</span>
            <span><kbd>☰</kbd> Menu</span>
            {touchHint && <span className="gamepad-hint-touch">{t('settings.gamepadHintTouch')}</span>}
        </div>
    )
}
