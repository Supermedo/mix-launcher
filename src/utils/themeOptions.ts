export const THEME_OPTIONS = [
    { id: 'dark', name: 'Gaming Dark', color: '#1b2838' },
    { id: 'midnight', name: 'Midnight', color: '#0f172a' },
    { id: 'cyberpunk', name: 'Cyberpunk', color: '#2d1b4e', border: '#ff00ff' },
    { id: 'oled', name: 'OLED Black', color: '#000000' },
    { id: 'forest', name: 'Forest', color: '#051a0d' },
    { id: 'rgb', name: 'RGB Gaming', color: 'linear-gradient(135deg, #ff0080, #00ff88)', border: '#ff0080' }
] as const

export const THEME_IDS = THEME_OPTIONS.map(t => t.id)

export type ThemeId = (typeof THEME_OPTIONS)[number]['id']
