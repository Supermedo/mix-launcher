import {
    detectGamepadProfile,
    GamepadProfile,
    mapButtonToAction,
    NavDirection,
    readNavigation,
    readNavigationGeneric
} from '../input/gamepadProfiles'
import type { ControllerLayout } from '../types/game'
import type { GamepadAction } from '../input/gamepadProfiles'

export interface GamepadDeviceInfo {
    index: number
    id: string
    mapping: string
    profile: GamepadProfile
    connected: boolean
}

export interface GamepadSubscriber {
    enabled: boolean
    layout: ControllerLayout
    /** When true, only this subscriber receives input (modals over Big Picture). */
    exclusive?: boolean
    onAction?: (action: GamepadAction) => void
    onNavigate?: (direction: NavDirection) => void
    navDebounceMs?: number
    stickDebounceMs?: number
}

type Listener = (devices: GamepadDeviceInfo[], activeIndex: number | null) => void

/** Polls all Gamepad API slots — required for many Windows controllers to appear. */
class GamepadManager {
    private subscribers = new Map<number, GamepadSubscriber & { id: number }>()
    private deviceListeners = new Set<Listener>()
    private nextSubId = 0
    private rafId = 0
    private wakeIntervalId = 0
    private started = false

    private devices: GamepadDeviceInfo[] = []
    private activeIndex: number | null = null
    private prevButtonsByIndex = new Map<number, boolean[]>()
    private lastNavTime = 0
    private lastStickNav = 0
    private notifyingDeviceListeners = false

    start() {
        if (this.started) return
        this.started = true

        const onSystemChange = () => this.refreshDevices()
        window.addEventListener('gamepadconnected', onSystemChange)
        window.addEventListener('gamepaddisconnected', onSystemChange)
        window.addEventListener('focus', onSystemChange)

        // Windows: occasional wake — not every frame (reduces idle CPU)
        this.wakeIntervalId = window.setInterval(() => {
            if (!document.hidden) this.refreshDevices()
        }, 1500)

        this.scheduleInputLoop()
        this.refreshDevices()
    }

    stop() {
        if (!this.started) return
        this.started = false
        cancelAnimationFrame(this.rafId)
        clearInterval(this.wakeIntervalId)
        this.rafId = 0
        this.wakeIntervalId = 0
    }

    private scheduleInputLoop() {
        if (this.rafId) return
        const loop = () => {
            if (!this.started) return
            if (this.subscribers.size > 0) this.tick()
            this.rafId = requestAnimationFrame(loop)
        }
        this.rafId = requestAnimationFrame(loop)
    }

    /** Force a scan — call from Settings "Detect controllers". */
    refreshDevices(): GamepadDeviceInfo[] {
        this.devices = scanAllGamepads()

        if (this.activeIndex !== null && !this.devices.some(d => d.index === this.activeIndex)) {
            this.prevButtonsByIndex.delete(this.activeIndex)
            this.activeIndex = null
        }

        if (this.activeIndex === null && this.devices.length > 0) {
            this.activeIndex = this.pickBestIdleIndex()
        }

        this.notifyDeviceListeners()
        return this.devices
    }

    getDevices(): GamepadDeviceInfo[] {
        return this.devices
    }

    getActiveIndex(): number | null {
        return this.activeIndex
    }

    hasAnyConnected(): boolean {
        return this.devices.length > 0
    }

    subscribeDeviceListener(listener: Listener): () => void {
        this.start()
        this.deviceListeners.add(listener)
        listener(this.devices, this.activeIndex)
        return () => this.deviceListeners.delete(listener)
    }

    subscribe(sub: GamepadSubscriber): () => void {
        this.start()
        const id = this.nextSubId++
        this.subscribers.set(id, { ...sub, id })
        this.scheduleInputLoop()

        return () => {
            this.subscribers.delete(id)
            if (this.subscribers.size === 0 && this.deviceListeners.size === 0) {
                this.stop()
            }
        }
    }

    private notifyDeviceListeners() {
        if (this.notifyingDeviceListeners) return
        this.notifyingDeviceListeners = true
        try {
            for (const fn of [...this.deviceListeners]) {
                fn(this.devices, this.activeIndex)
            }
        } finally {
            this.notifyingDeviceListeners = false
        }
    }

    private pickBestIdleIndex(): number {
        const pads = navigator.getGamepads?.() ?? []
        let best = this.devices[0]?.index ?? 0
        let bestScore = -1
        for (const dev of this.devices) {
            const pad = pads[dev.index]
            if (!pad) continue
            const score = activityScore(pad)
            if (score > bestScore) {
                bestScore = score
                best = dev.index
            }
        }
        return best
    }

    private getActiveGamepad(): Gamepad | null {
        const pads = navigator.getGamepads?.() ?? []
        let bestIndex: number | null = null
        let bestScore = 0

        for (let i = 0; i < pads.length; i++) {
            const pad = pads[i]
            if (!pad?.connected) continue
            const score = activityScore(pad)
            if (score > bestScore) {
                bestScore = score
                bestIndex = i
            }
        }

        if (bestIndex !== null && bestScore > 0) {
            this.activeIndex = bestIndex
        } else if (this.activeIndex !== null && pads[this.activeIndex]?.connected) {
            bestIndex = this.activeIndex
        } else if (this.devices.length > 0) {
            bestIndex = this.devices[0].index
            this.activeIndex = bestIndex
        } else {
            return null
        }

        return pads[bestIndex!] ?? null
    }

    private tick() {
        if (document.hidden) return

        // Wake HID / XInput stack
        navigator.getGamepads?.()

        if (this.subscribers.size === 0) return

        const pad = this.getActiveGamepad()
        if (!pad) return

        const index = this.activeIndex!
        const profile = detectGamepadProfile(pad)
        const buttons = Array.from(pad.buttons).map(b => b.pressed || b.value > 0.55)
        const axes = pad.axes
        const prevButtons = this.prevButtonsByIndex.get(index) ?? []
        const now = Date.now()

        const isNewPress = (i: number) => buttons[i] && !prevButtons[i]

        const activeSubs = this.getActiveSubscribers()
        for (const sub of activeSubs) {
            if (!sub.enabled) continue

            for (let i = 0; i < buttons.length; i++) {
                if (!isNewPress(i)) continue
                const action = mapButtonToAction(i, sub.layout, profile, pad.mapping)
                if (action) sub.onAction?.(action)
            }

            const direction =
                pad.mapping === 'standard' || profile === 'xbox'
                    ? readNavigation(buttons, axes)
                    : readNavigationGeneric(buttons, axes, profile)

            if (direction) {
                const fromStick = !buttons[12] && !buttons[13] && !buttons[14] && !buttons[15]
                const delay = fromStick ? (sub.stickDebounceMs ?? 200) : (sub.navDebounceMs ?? 150)
                const last = fromStick ? this.lastStickNav : this.lastNavTime
                if (now - last >= delay) {
                    if (fromStick) this.lastStickNav = now
                    else this.lastNavTime = now
                    sub.onNavigate?.(direction)
                }
            }
        }

        this.prevButtonsByIndex.set(index, buttons)
    }

    /** Exclusive modal subscribers take over; otherwise all enabled subscribers receive input. */
    private getActiveSubscribers(): Array<GamepadSubscriber & { id: number }> {
        const enabled = [...this.subscribers.values()].filter(s => s.enabled)
        const exclusive = enabled.filter(s => s.exclusive)
        if (exclusive.length > 0) {
            return [exclusive[exclusive.length - 1]]
        }
        return enabled
    }
}

function activityScore(pad: Gamepad): number {
    let score = 0
    for (const b of pad.buttons) {
        if (b.pressed || b.value > 0.45) score += 10
    }
    for (const a of pad.axes) {
        if (Math.abs(a) > 0.2) score += 4
    }
    return score
}

export function scanAllGamepads(): GamepadDeviceInfo[] {
    const raw = navigator.getGamepads?.() ?? []
    const list: GamepadDeviceInfo[] = []

    for (let i = 0; i < raw.length; i++) {
        const pad = raw[i]
        if (!pad?.connected) continue
        list.push({
            index: i,
            id: pad.id,
            mapping: pad.mapping || 'unknown',
            profile: detectGamepadProfile(pad),
            connected: true
        })
    }

    return list
}

export function getActiveGamepadFromScan(): Gamepad | null {
    const pads = navigator.getGamepads?.() ?? []
    let best: Gamepad | null = null
    let bestScore = 0
    for (let i = 0; i < pads.length; i++) {
        const pad = pads[i]
        if (!pad?.connected) continue
        const score = activityScore(pad)
        if (score > bestScore || !best) {
            bestScore = score
            best = pad
        }
    }
    if (best) return best
    for (let i = 0; i < pads.length; i++) {
        if (pads[i]?.connected) return pads[i]
    }
    return null
}

export const gamepadManager = new GamepadManager()
