import React, { useCallback, useEffect, useState } from 'react'
import { TdpPreset } from '../types/game'
import { useLanguage } from '../context/LanguageContext'
import type { TdpDetectResult } from '../types/electron'

interface TdpControlProps {
    enabled: boolean
    preset: TdpPreset
    customWatts: number
    ryzenAdjPath: string
    applyOnStart: boolean
    applyOnGameLaunch: boolean
    onEnabledChange: (v: boolean) => void
    onPresetChange: (v: TdpPreset) => void
    onCustomWattsChange: (v: number) => void
    onRyzenAdjPathChange: (v: string) => void
    onApplyOnStartChange: (v: boolean) => void
    onApplyOnGameLaunchChange: (v: boolean) => void
}

export const TdpControl: React.FC<TdpControlProps> = ({
    enabled,
    preset,
    customWatts,
    ryzenAdjPath,
    applyOnStart,
    applyOnGameLaunch,
    onEnabledChange,
    onPresetChange,
    onCustomWattsChange,
    onRyzenAdjPathChange,
    onApplyOnStartChange,
    onApplyOnGameLaunchChange
}) => {
    const { t } = useLanguage()
    const [detect, setDetect] = useState<TdpDetectResult | null>(null)
    const [applying, setApplying] = useState(false)
    const [status, setStatus] = useState<string | null>(null)

    const refreshDetect = useCallback(async () => {
        if (!window.electronAPI?.tdpDetect) return
        const result = await window.electronAPI.tdpDetect(ryzenAdjPath || undefined)
        setDetect(result)
    }, [ryzenAdjPath])

    useEffect(() => {
        void refreshDetect()
    }, [refreshDetect])

    const handleBrowse = async () => {
        if (!window.electronAPI?.tdpBrowseRyzenAdj) return
        const picked = await window.electronAPI.tdpBrowseRyzenAdj()
        if (picked) {
            onRyzenAdjPathChange(picked)
            setStatus(null)
        }
    }

    const handleApplyNow = async () => {
        if (!window.electronAPI?.tdpApply) return
        setApplying(true)
        setStatus(null)
        try {
            const result = await window.electronAPI.tdpApply({
                preset,
                customWatts,
                ryzenAdjPath: ryzenAdjPath || undefined
            })
            if (result.success) {
                const w = result.watts ?? customWatts
                setStatus(`${t('settings.tdpApplySuccess')} (${w}W)`)
            } else {
                setStatus(result.error || t('settings.tdpApplyFailed'))
            }
        } catch {
            setStatus(t('settings.tdpApplyFailed'))
        } finally {
            setApplying(false)
        }
    }

    const presetWatts: Record<TdpPreset, number | null> = {
        eco: 8,
        balanced: 15,
        performance: 25,
        turbo: 30,
        custom: null
    }

    return (
        <div className="tdp-control" style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem' }}>{t('settings.tdpTitle')}</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '0 0 12px' }}>{t('settings.tdpDesc')}</p>

            {detect && (
                <div
                    style={{
                        fontSize: '0.8rem',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        marginBottom: '12px',
                        background: detect.ryzenAdjFound ? 'rgba(76, 175, 80, 0.12)' : 'rgba(255, 152, 0, 0.12)',
                        color: 'var(--color-text-secondary)'
                    }}
                >
                    {detect.message}
                    {detect.ryzenAdjPath && (
                        <div style={{ marginTop: '4px', opacity: 0.85, wordBreak: 'break-all' }}>{detect.ryzenAdjPath}</div>
                    )}
                </div>
            )}

            <div className="form-group checkbox-group">
                <label>
                    <input type="checkbox" checked={enabled} onChange={e => onEnabledChange(e.target.checked)} />
                    {t('settings.tdpEnabled')}
                </label>
            </div>

            {enabled && (
                <>
                    <div className="form-group" style={{ marginTop: '0.75rem' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
                            {t('settings.tdpPreset')}
                        </label>
                        <select
                            value={preset}
                            onChange={e => onPresetChange(e.target.value as TdpPreset)}
                            style={{ width: '100%', padding: '8px', borderRadius: '8px' }}
                        >
                            <option value="eco">{t('settings.tdpEco')} (8W)</option>
                            <option value="balanced">{t('settings.tdpBalanced')} (15W)</option>
                            <option value="performance">{t('settings.tdpPerformance')} (25W)</option>
                            <option value="turbo">{t('settings.tdpTurbo')} (30W)</option>
                            <option value="custom">{t('settings.tdpCustom')}</option>
                        </select>
                    </div>

                    {preset === 'custom' && (
                        <div className="form-group" style={{ marginTop: '0.75rem' }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
                                {t('settings.tdpCustomWatts')}: {customWatts}W
                            </label>
                            <input
                                type="range"
                                min={5}
                                max={45}
                                step={1}
                                value={customWatts}
                                onChange={e => onCustomWattsChange(Number(e.target.value))}
                                style={{ width: '100%' }}
                            />
                        </div>
                    )}

                    {preset !== 'custom' && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>
                            {t('settings.tdpTarget')}: {presetWatts[preset]}W
                        </p>
                    )}

                    <div className="form-group" style={{ marginTop: '0.75rem' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
                            {t('settings.ryzenAdjPath')}
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                value={ryzenAdjPath}
                                onChange={e => onRyzenAdjPathChange(e.target.value)}
                                placeholder="ryzenadj.exe"
                                style={{ flex: 1, padding: '8px', borderRadius: '8px' }}
                            />
                            <button type="button" className="btn btn-secondary" onClick={() => void handleBrowse()}>
                                …
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={() => void refreshDetect()}>
                                {t('settings.tdpRescan')}
                            </button>
                        </div>
                    </div>

                    <div className="form-group checkbox-group" style={{ marginTop: '0.5rem' }}>
                        <label>
                            <input type="checkbox" checked={applyOnStart} onChange={e => onApplyOnStartChange(e.target.checked)} />
                            {t('settings.tdpApplyOnStart')}
                        </label>
                    </div>

                    <div className="form-group checkbox-group" style={{ marginTop: '0.5rem' }}>
                        <label>
                            <input type="checkbox" checked={applyOnGameLaunch} onChange={e => onApplyOnGameLaunchChange(e.target.checked)} />
                            {t('settings.tdpApplyOnGameLaunch')}
                        </label>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={applying || !detect?.ryzenAdjFound}
                            onClick={() => void handleApplyNow()}
                        >
                            {applying ? t('settings.tdpApplying') : t('settings.tdpApplyNow')}
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => void window.electronAPI?.openExternal('https://github.com/FlyGoat/RyzenAdj')}
                        >
                            {t('settings.tdpGetRyzenAdj')}
                        </button>
                    </div>

                    {status && (
                        <p style={{ fontSize: '0.8rem', marginTop: '10px', color: 'var(--color-text-secondary)' }}>{status}</p>
                    )}
                </>
            )}
        </div>
    )
}
