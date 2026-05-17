import { useEffect, useState } from 'react'
import { gamepadManager, GamepadDeviceInfo } from '../services/gamepadManager'

export function useGamepadDevices() {
    const [devices, setDevices] = useState<GamepadDeviceInfo[]>([])
    const [activeIndex, setActiveIndex] = useState<number | null>(null)

    useEffect(() => {
        gamepadManager.start()
        const unsub = gamepadManager.subscribeDeviceListener((list, active) => {
            setDevices(list)
            setActiveIndex(active)
        })
        gamepadManager.refreshDevices()
        return unsub
    }, [])

    const rescan = () => gamepadManager.refreshDevices()

    return {
        devices,
        activeIndex,
        hasAny: devices.length > 0,
        rescan
    }
}
