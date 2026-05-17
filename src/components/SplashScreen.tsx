import React, { useEffect, useState } from 'react'
import { APP_NAME } from '../constants/app'
import './SplashScreen.css'

interface SplashScreenProps {
    onFinish: () => void
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
    const [progress, setProgress] = useState(0)
    const [fadeOut, setFadeOut] = useState(false)

    useEffect(() => {
        // Simulate loading progress
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval)
                    setFadeOut(true)
                    setTimeout(onFinish, 500)
                    return 100
                }
                return prev + 2
            })
        }, 30)

        return () => clearInterval(interval)
    }, [onFinish])

    return (
        <div className={`splash-screen ${fadeOut ? 'fade-out' : ''}`}>
            <div className="splash-background">
                <div className="splash-gradient-1"></div>
                <div className="splash-gradient-2"></div>
                <div className="splash-gradient-3"></div>
            </div>

            <div className="splash-content">
                <div className="splash-logo">
                    <div className="logo-circle">
                        <svg viewBox="0 0 100 100" width="120" height="120">
                            <defs>
                                <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#6366f1" />
                                    <stop offset="50%" stopColor="#8b5cf6" />
                                    <stop offset="100%" stopColor="#d946ef" />
                                </linearGradient>
                            </defs>
                            <circle cx="50" cy="50" r="45" fill="none" stroke="url(#logoGradient)" strokeWidth="3" opacity="0.3" />
                            <path
                                d="M 30 50 L 45 35 L 45 45 L 70 45 L 70 35 L 85 50 L 70 65 L 70 55 L 45 55 L 45 65 Z"
                                fill="url(#logoGradient)"
                            />
                        </svg>
                    </div>
                </div>

                <h1 className="splash-title">
                    {APP_NAME.split(' ').map(word => (
                        <span key={word} className="title-word">{word}</span>
                    ))}
                </h1>

                <p className="splash-subtitle">All Your Games in One Place</p>

                <div className="splash-progress-container">
                    <div className="splash-progress-bar">
                        <div 
                            className="splash-progress-fill" 
                            style={{ width: `${progress}%` }}
                        >
                            <div className="progress-shimmer"></div>
                        </div>
                    </div>
                    <div className="splash-progress-text">{progress}%</div>
                </div>

                <div className="splash-dots">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                </div>
            </div>

            <div className="splash-footer">
                <p>Loading your game library...</p>
            </div>
        </div>
    )
}
