import React from 'react'
import { useLanguage } from '../context/LanguageContext'

export interface BackgroundTaskState {
    active: boolean
    message: string
    progress: number
    total: number
}

interface BackgroundFetchBannerProps {
    task: BackgroundTaskState
    onSkip: () => void
}

export const BackgroundFetchBanner: React.FC<BackgroundFetchBannerProps> = ({ task, onSkip }) => {
    const { t } = useLanguage()

    if (!task.active) return null

    const label = task.message
        ? `${t('loading.fetchingArtwork')} ${task.message}`
        : t('loading.fetchingArtwork')

    return (
        <div className="background-fetch-banner" role="status">
            <div className="background-fetch-banner-text">
                <span>{label}</span>
                {task.total > 0 && (
                    <span className="background-fetch-banner-count">
                        {task.progress} / {task.total}
                    </span>
                )}
            </div>
            <p className="background-fetch-banner-hint">{t('loading.useLibraryNow')}</p>
            {task.total > 0 && (
                <div className="loading-progress background-fetch-progress">
                    <div
                        className="loading-progress-bar"
                        style={{ width: `${Math.min(100, (task.progress / task.total) * 100)}%` }}
                    />
                </div>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={onSkip}>
                {t('loading.skipFetch')}
            </button>
        </div>
    )
}
