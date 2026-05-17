import React from 'react'
import { useGamepadDevices } from '../hooks/useGamepadDevices'
import { useLanguage } from '../context/LanguageContext'

export const ControllerStatus: React.FC = () => {
    const { t } = useLanguage()
    const { devices, activeIndex, hasAny, rescan } = useGamepadDevices()

    return (
        <div className="controller-status">
            <div className="controller-status-header">
                <span className="controller-status-title">{t('settings.controllers')}</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => rescan()}>
                    {t('settings.scanControllers')}
                </button>
            </div>

            {!hasAny ? (
                <p className="controller-status-empty">{t('settings.noControllers')}</p>
            ) : (
                <ul className="controller-status-list">
                    {devices.map(dev => (
                        <li
                            key={dev.index}
                            className={`controller-status-item${dev.index === activeIndex ? ' active' : ''}`}
                        >
                            <span className="controller-status-icon">🎮</span>
                            <div className="controller-status-meta">
                                <span className="controller-status-name">{formatName(dev.id)}</span>
                                <span className="controller-status-detail">
                                    {t('settings.controllerSlot')}: {dev.index}
                                    {' · '}
                                    {dev.profile}
                                    {dev.mapping !== 'unknown' ? ` · ${dev.mapping}` : ''}
                                </span>
                            </div>
                            {dev.index === activeIndex && (
                                <span className="controller-status-badge">{t('settings.controllerActive')}</span>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            <p className="controller-status-hint">{t('settings.controllerWakeHint')}</p>
        </div>
    )
}

function formatName(id: string): string {
    const trimmed = id.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
    return trimmed.length > 48 ? `${trimmed.slice(0, 45)}…` : trimmed || 'Controller'
}
