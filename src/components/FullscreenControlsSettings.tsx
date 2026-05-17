import React from 'react'
import {
    FULLSCREEN_CONTROL_ACTIONS,
    FULLSCREEN_GAMEPAD_BUTTONS,
    type FullscreenControlAction,
    type FullscreenControlBinding,
    type FullscreenControls
} from '../types/fullscreenControls'
import { fullscreenButtonLabel } from '../types/fullscreenControls'
import type { ControllerLayout } from '../types/game'
import { useLanguage } from '../context/LanguageContext'

interface FullscreenControlsSettingsProps {
    controls: FullscreenControls
    layout: ControllerLayout
    onChange: (controls: FullscreenControls) => void
}

export const FullscreenControlsSettings: React.FC<FullscreenControlsSettingsProps> = ({
    controls,
    layout,
    onChange
}) => {
    const { t } = useLanguage()

    const setBinding = (action: FullscreenControlAction, binding: FullscreenControlBinding) => {
        onChange({ ...controls, [action]: binding })
    }

    const bindingOptions: FullscreenControlBinding[] = ['none', ...FULLSCREEN_GAMEPAD_BUTTONS]

    return (
        <div className="form-group" style={{ marginTop: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '4px', color: 'var(--color-text-secondary)' }}>
                {t('settings.fullscreenControls')}
            </label>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                {t('settings.fullscreenControlsDesc')}
            </p>
            <div className="fullscreen-controls-grid">
                {FULLSCREEN_CONTROL_ACTIONS.map(action => (
                    <div key={action} className="fullscreen-controls-row">
                        <span className="fullscreen-controls-label">{t(`settings.fsAction.${action}`)}</span>
                        <select
                            value={controls[action]}
                            onChange={e => setBinding(action, e.target.value as FullscreenControlBinding)}
                            className="fullscreen-controls-select"
                        >
                            {bindingOptions.map(opt => (
                                <option key={opt} value={opt}>
                                    {opt === 'none'
                                        ? t('settings.fsButton.none')
                                        : fullscreenButtonLabel(opt, layout)}
                                </option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>
        </div>
    )
}
