import { useEffect, useRef, useState } from 'react'
import type { GamepadAction, NavDirection } from '../input/gamepadProfiles'
import { gamepadManager } from '../services/gamepadManager'
import type { ControllerLayout } from '../types/game'

export interface UseGamepadInputOptions {
    enabled?: boolean
    layout?: ControllerLayout
    /** Block Big Picture / grid handlers while a modal is open. */
    exclusive?: boolean
    navDebounceMs?: number
    stickDebounceMs?: number
    onAction?: (action: GamepadAction) => void
    onNavigate?: (direction: NavDirection) => void
}

export function useGamepadInput({
    enabled = true,
    layout = 'xbox',
    exclusive = false,
    navDebounceMs = 150,
    stickDebounceMs = 200,
    onAction,
    onNavigate
}: UseGamepadInputOptions = {}) {
    const [connected, setConnected] = useState(false)
    const onActionRef = useRef(onAction)
    const onNavigateRef = useRef(onNavigate)

    onActionRef.current = onAction
    onNavigateRef.current = onNavigate

    useEffect(() => {
        if (!enabled) {
            setConnected(false)
            return
        }

        const unsubDevices = gamepadManager.subscribeDeviceListener((devices) => {
            setConnected(devices.length > 0)
        })

        const unsubInput = gamepadManager.subscribe({
            enabled: true,
            layout,
            exclusive,
            navDebounceMs,
            stickDebounceMs,
            onAction: (action) => onActionRef.current?.(action),
            onNavigate: (dir) => onNavigateRef.current?.(dir)
        })

        gamepadManager.refreshDevices()

        return () => {
            unsubDevices()
            unsubInput()
            setConnected(false)
        }
    }, [enabled, layout, exclusive, navDebounceMs, stickDebounceMs])

    return { connected, layout }
}

export { useGamepadInput as useGamepad }
