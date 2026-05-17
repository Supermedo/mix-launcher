import React from 'react'
import { useLanguage } from '../context/LanguageContext'

export interface LoadingOverlayState {
    isLoading: boolean
    message: string
    progress: number
    total: number
}

interface LoadingOverlayProps {
    loading: LoadingOverlayState
    onBack: () => void
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ loading, onBack }) => {
    const { t } = useLanguage()

    if (!loading.isLoading) return null

    return (
        <div className="loading-screen" style={{ height: 'calc(100vh - 40px)' }}>
            <div className="loading-spinner" />
            <div className="loading-text">{loading.message}</div>
            {loading.total > 0 && (
                <>
                    <div className="loading-progress">
                        <div
                            className="loading-progress-bar"
                            style={{ width: `${(loading.progress / loading.total) * 100}%` }}
                        />
                    </div>
                    <div className="loading-text" style={{ marginTop: '8px', fontSize: '0.75rem' }}>
                        {loading.progress} / {loading.total}
                    </div>
                </>
            )}
            <button type="button" className="btn btn-secondary loading-back-btn" onClick={onBack}>
                {t('common.back')}
            </button>
        </div>
    )
}
