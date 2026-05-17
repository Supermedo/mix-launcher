import type { ControllerLayout } from '../types/game'

export type GamepadProfile = 'xbox' | 'playstation' | 'nintendo' | 'generic'

/** Standard Xbox / XInput button indices (Windows handheld built-in controls). */
export const XBOX_BUTTONS = {
    A: 0,
    B: 1,
    X: 2,
    Y: 3,
    LB: 4,
    RB: 5,
    LT: 6,
    RT: 7,
    SELECT: 8,
    START: 9,
    L3: 10,
    R3: 11,
    DPAD_UP: 12,
    DPAD_DOWN: 13,
    DPAD_LEFT: 14,
    DPAD_RIGHT: 15
} as const

/** PlayStation on some drivers uses same order as Xbox; extras for non-standard mapping. */
const PS_BUTTONS = {
    CROSS: 0,
    CIRCLE: 1,
    SQUARE: 2,
    TRIANGLE: 3,
    L1: 4,
    R1: 5,
    SELECT: 8,
    START: 9,
    DPAD_UP: 12,
    DPAD_DOWN: 13,
    DPAD_LEFT: 14,
    DPAD_RIGHT: 15
} as const

export type GamepadAction = 'confirm' | 'back' | 'menu' | 'x' | 'y' | 'lb' | 'rb'
export type NavDirection = 'up' | 'down' | 'left' | 'right'

export function detectGamepadProfile(gamepad: Gamepad): GamepadProfile {
    const id = gamepad.id.toLowerCase()

    if (
        gamepad.mapping === 'standard' ||
        id.includes('xbox') ||
        id.includes('xinput') ||
        id.includes('045e') ||
        id.includes('8bitdo') ||
        id.includes('logitech') ||
        id.includes('flydigi') ||
        id.includes('rog') ||
        id.includes('ally')
    ) {
        return 'xbox'
    }

    if (
        id.includes('054c') ||
        id.includes('playstation') ||
        id.includes('dualsense') ||
        id.includes('dualshock') ||
        id.includes('ps5') ||
        id.includes('ps4')
    ) {
        return 'playstation'
    }

    if (
        id.includes('057e') ||
        id.includes('nintendo') ||
        id.includes('switch') ||
        id.includes('pro controller')
    ) {
        return 'nintendo'
    }

    return 'generic'
}

export function getConfirmBackIndices(layout: ControllerLayout): { confirm: number; back: number } {
    if (layout === 'nintendo') {
        return { confirm: XBOX_BUTTONS.B, back: XBOX_BUTTONS.A }
    }
    return { confirm: XBOX_BUTTONS.A, back: XBOX_BUTTONS.B }
}

function getProfileConfirmBack(
    layout: ControllerLayout,
    profile: GamepadProfile
): { confirm: number; back: number } {
    if (layout === 'nintendo' || profile === 'nintendo') {
        return { confirm: XBOX_BUTTONS.B, back: XBOX_BUTTONS.A }
    }
    if (profile === 'playstation') {
        return { confirm: PS_BUTTONS.CROSS, back: PS_BUTTONS.CIRCLE }
    }
    return getConfirmBackIndices(layout)
}

export function mapButtonToAction(
    buttonIndex: number,
    layout: ControllerLayout,
    profile: GamepadProfile = 'xbox',
    mapping = ''
): GamepadAction | null {
    const { confirm, back } = getProfileConfirmBack(layout, profile)

    if (buttonIndex === confirm) return 'confirm'
    if (buttonIndex === back) return 'back'

    const startIdx =
        profile === 'playstation' ? PS_BUTTONS.START : XBOX_BUTTONS.START

    if (buttonIndex === startIdx) return 'menu'

    const xIdx = profile === 'playstation' ? PS_BUTTONS.SQUARE : XBOX_BUTTONS.X
    const yIdx = profile === 'playstation' ? PS_BUTTONS.TRIANGLE : XBOX_BUTTONS.Y
    const lbIdx = profile === 'playstation' ? PS_BUTTONS.L1 : XBOX_BUTTONS.LB
    const rbIdx = profile === 'playstation' ? PS_BUTTONS.R1 : XBOX_BUTTONS.RB

    if (buttonIndex === xIdx) return 'x'
    if (buttonIndex === yIdx) return 'y'
    if (buttonIndex === lbIdx) return 'lb'
    if (buttonIndex === rbIdx) return 'rb'

    // Non-standard mapping: first pressed face button cluster
    if (mapping !== 'standard' && profile === 'generic') {
        if (buttonIndex === 0) return 'confirm'
        if (buttonIndex === 1) return 'back'
        if (buttonIndex === 2) return 'x'
        if (buttonIndex === 3) return 'y'
    }

    return null
}

export function readNavigation(
    buttons: boolean[],
    axes: readonly number[],
    threshold = 0.45
): NavDirection | null {
    if (buttons[XBOX_BUTTONS.DPAD_UP]) return 'up'
    if (buttons[XBOX_BUTTONS.DPAD_DOWN]) return 'down'
    if (buttons[XBOX_BUTTONS.DPAD_LEFT]) return 'left'
    if (buttons[XBOX_BUTTONS.DPAD_RIGHT]) return 'right'
    if (axes[0] < -threshold) return 'left'
    if (axes[0] > threshold) return 'right'
    if (axes[1] < -threshold) return 'up'
    if (axes[1] > threshold) return 'down'
    return null
}

/** Fallback when mapping is not "standard" — try d-pad indices and axes. */
export function readNavigationGeneric(
    buttons: boolean[],
    axes: readonly number[],
    profile: GamepadProfile,
    threshold = 0.45
): NavDirection | null {
    const nav = readNavigation(buttons, axes, threshold)
    if (nav) return nav

    // Axis 2/3 on some pads are right stick — try axis 6/7 for d-pad hats
    if (axes.length >= 8) {
        if (axes[6] < -threshold || axes[7] < -threshold) return 'left'
        if (axes[6] > threshold || axes[7] > threshold) return 'right'
    }

    if (profile === 'generic' && axes.length >= 2) {
        if (axes[0] < -threshold) return 'left'
        if (axes[0] > threshold) return 'right'
        if (axes[1] < -threshold) return 'up'
        if (axes[1] > threshold) return 'down'
    }

    return null
}

/** @deprecated Use gamepadManager.getDevices() or getActiveGamepadFromScan() */
export function getFirstConnectedGamepad(): Gamepad | null {
    const pads = navigator.getGamepads?.() ?? []
    let best: Gamepad | null = null
    for (let i = 0; i < pads.length; i++) {
        const pad = pads[i]
        if (pad?.connected) best = pad
    }
    return best
}
