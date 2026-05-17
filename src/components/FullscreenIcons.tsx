import React from 'react'
import type { FullscreenFilterId } from '../utils/fullscreenNav'

export type QuickMenuAction = 'toggleView' | 'scanGames' | 'addGame' | 'settings' | 'exit' | 'close'

export interface FsIconProps {
    size?: number
    className?: string
}

function svgProps(size: number, className?: string) {
    return {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        className,
        'aria-hidden': true as const
    }
}

export const FsGamepadIcon: React.FC<FsIconProps> = ({ size = 24, className }) => (
    <svg {...svgProps(size, className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 11h4M8 9v4" />
        <path d="M15 12h.01M18 10h.01" />
        <rect x="2" y="6" width="20" height="12" rx="4" />
    </svg>
)

export const FsControllerIcon: React.FC<FsIconProps> = ({ size = 16, className }) => (
    <svg {...svgProps(size, className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 12h2M10 10v4" />
        <path d="M15 11h.01M17 13h.01" />
        <path d="M17 6H7a4 4 0 0 0-4 4v4a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4v-4a4 4 0 0 0-4-4z" />
    </svg>
)

export const FsBatteryIcon: React.FC<FsIconProps & { charging?: boolean }> = ({ size = 16, className, charging }) => (
    <svg {...svgProps(size, className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="16" height="10" rx="2" />
        <path d="M22 11v2" />
        {charging && <path d="M10 10v4l3-2-3-2z" fill="currentColor" stroke="none" />}
    </svg>
)

export const FsHeartIcon: React.FC<FsIconProps> = ({ size = 14, className }) => (
    <svg {...svgProps(size, className)} fill="currentColor" stroke="none">
        <path d="M12 21s-7-4.6-9.5-8.5C.9 9.6 2.5 6 6 6c2 0 3.2 1.2 4 2.4C10.8 7.2 12 6 14 6c3.5 0 5.1 3.6 3.5 6.5C19 16.4 12 21 12 21z" />
    </svg>
)

export const FsStarIcon: React.FC<FsIconProps & { filled?: boolean }> = ({ size = 16, className, filled }) => (
    <svg {...svgProps(size, className)} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
    </svg>
)

export const FsCheckIcon: React.FC<FsIconProps> = ({ size = 14, className }) => (
    <svg {...svgProps(size, className)} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
    </svg>
)

export const FsEmptyIcon: React.FC<FsIconProps> = ({ size = 48, className }) => (
    <svg {...svgProps(size, className)} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M8 10h8M8 14h5" />
    </svg>
)

export const FsLayoutGridIcon: React.FC<FsIconProps> = ({ size = 18, className }) => (
    <svg {...svgProps(size, className)} fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
)

export const FsLayoutListIcon: React.FC<FsIconProps> = ({ size = 18, className }) => (
    <svg {...svgProps(size, className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
)

export const FsSearchIcon: React.FC<FsIconProps> = ({ size = 18, className }) => (
    <svg {...svgProps(size, className)} fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3-3" />
    </svg>
)

export const FsPlusIcon: React.FC<FsIconProps> = ({ size = 18, className }) => (
    <svg {...svgProps(size, className)} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5v14M5 12h14" />
    </svg>
)

export const FsSettingsIcon: React.FC<FsIconProps> = ({ size = 18, className }) => (
    <svg {...svgProps(size, className)} fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
)

export const FsLogOutIcon: React.FC<FsIconProps> = ({ size = 18, className }) => (
    <svg {...svgProps(size, className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
)

export const FsCloseIcon: React.FC<FsIconProps> = ({ size = 18, className }) => (
    <svg {...svgProps(size, className)} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 6L6 18M6 6l12 12" />
    </svg>
)

export const FsAllGamesIcon: React.FC<FsIconProps> = ({ size = 16, className }) => (
    <svg {...svgProps(size, className)} fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="6" width="20" height="12" rx="3" />
        <path d="M6 12h2M10 10v4M15 11h.01M18 13h.01" />
    </svg>
)

export const FsInstalledIcon: React.FC<FsIconProps> = ({ size = 16, className }) => (
    <svg {...svgProps(size, className)} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </svg>
)

export const FsRecentIcon: React.FC<FsIconProps> = ({ size = 16, className }) => (
    <svg {...svgProps(size, className)} fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
    </svg>
)

export function FsNavFilterIcon({ id, size = 16 }: { id: FullscreenFilterId; size?: number }) {
    switch (id) {
        case 'all':
            return <FsAllGamesIcon size={size} />
        case 'installed':
            return <FsInstalledIcon size={size} />
        case 'favorites':
            return <FsHeartIcon size={size} />
        case 'recent':
            return <FsRecentIcon size={size} />
        default:
            return null
    }
}

export function FsQuickMenuIcon({ action, horizontal }: { action: QuickMenuAction; horizontal: boolean }) {
    switch (action) {
        case 'toggleView':
            return horizontal ? <FsLayoutListIcon /> : <FsLayoutGridIcon />
        case 'scanGames':
            return <FsSearchIcon />
        case 'addGame':
            return <FsPlusIcon />
        case 'settings':
            return <FsSettingsIcon />
        case 'exit':
            return <FsLogOutIcon />
        case 'close':
            return <FsCloseIcon />
    }
}
