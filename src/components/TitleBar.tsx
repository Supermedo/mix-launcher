import React from 'react'

interface TitleBarProps {
    onMinimize: () => void
    onMaximize: () => void
    onClose: () => void
}

import { useLanguage } from '../context/LanguageContext'
import { APP_NAME } from '../constants/app'

export const TitleBar: React.FC<TitleBarProps> = ({
    onMinimize,
    onMaximize,
    onClose
}) => {
    const { t } = useLanguage()

    return (
        <div className="title-bar">
            <div className="title-bar-logo">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                </svg>
                <span>{APP_NAME}</span>
            </div>

            <div className="title-bar-controls">
                <button className="title-bar-btn" onClick={onMinimize} title={t('titleBar.minimize')}>
                    <svg width="12" height="12" viewBox="0 0 12 12">
                        <rect y="5" width="12" height="2" fill="currentColor" />
                    </svg>
                </button>

                <button className="title-bar-btn" onClick={onMaximize} title={t('titleBar.maximize')}>
                    <svg width="12" height="12" viewBox="0 0 12 12">
                        <rect width="12" height="12" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
                    </svg>
                </button>

                <button className="title-bar-btn close" onClick={onClose} title={t('titleBar.close')}>
                    <svg width="12" height="12" viewBox="0 0 12 12">
                        <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="2" />
                    </svg>
                </button>
            </div>
        </div>
    )
}
