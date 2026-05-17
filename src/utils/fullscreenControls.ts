import { XBOX_BUTTONS, type GamepadProfile } from '../input/gamepadProfiles'
import type { ControllerLayout } from '../types/game'
import {
    DEFAULT_FULLSCREEN_CONTROLS,
    type FullscreenControlAction,
    type FullscreenControlBinding,
    type FullscreenControls,
    type FullscreenGamepadButton,
    mergeFullscreenControls
} from '../types/fullscreenControls'

export { mergeFullscreenControls, DEFAULT_FULLSCREEN_CONTROLS }

/** Map a binding id to the standard gamepad button index. */
export function getPhysicalButtonIndex(
    button: FullscreenGamepadButton,
    layout: ControllerLayout,
    profile: GamepadProfile = 'xbox'
): number {
    switch (button) {
        case 'dpadUp':
            return XBOX_BUTTONS.DPAD_UP
        case 'dpadDown':
            return XBOX_BUTTONS.DPAD_DOWN
        case 'dpadLeft':
            return XBOX_BUTTONS.DPAD_LEFT
        case 'dpadRight':
            return XBOX_BUTTONS.DPAD_RIGHT
        case 'start':
            return XBOX_BUTTONS.START
        case 'select':
            return XBOX_BUTTONS.SELECT
        case 'lb':
            return XBOX_BUTTONS.LB
        case 'rb':
            return XBOX_BUTTONS.RB
        case 'lt':
            return XBOX_BUTTONS.LT
        case 'rt':
            return XBOX_BUTTONS.RT
        default:
            break
    }

    const xboxFace: Record<'a' | 'b' | 'x' | 'y', number> = {
        a: XBOX_BUTTONS.A,
        b: XBOX_BUTTONS.B,
        x: XBOX_BUTTONS.X,
        y: XBOX_BUTTONS.Y
    }

    if (layout === 'nintendo') {
        const nintendoFace: Record<'a' | 'b' | 'x' | 'y', number> = {
            a: XBOX_BUTTONS.B,
            b: XBOX_BUTTONS.A,
            x: XBOX_BUTTONS.Y,
            y: XBOX_BUTTONS.X
        }
        return nintendoFace[button as 'a' | 'b' | 'x' | 'y']
    }

    if (profile === 'playstation' && (button === 'a' || button === 'b' || button === 'x' || button === 'y')) {
        const psFace: Record<'a' | 'b' | 'x' | 'y', number> = {
            a: 0,
            b: 1,
            x: 2,
            y: 3
        }
        return psFace[button]
    }

    return xboxFace[button as 'a' | 'b' | 'x' | 'y']
}

export function getBindingButtonIndex(
    binding: FullscreenControlBinding,
    layout: ControllerLayout,
    profile: GamepadProfile
): number | null {
    if (binding === 'none') return null
    return getPhysicalButtonIndex(binding, layout, profile)
}

/** Which action is bound to this pressed button index (first match). */
export function resolveFullscreenAction(
    buttonIndex: number,
    controls: FullscreenControls,
    layout: ControllerLayout,
    profile: GamepadProfile
): FullscreenControlAction | null {
    for (const action of Object.keys(controls) as FullscreenControlAction[]) {
        const binding = controls[action]
        const idx = getBindingButtonIndex(binding, layout, profile)
        if (idx !== null && idx === buttonIndex) {
            return action
        }
    }
    return null
}

export function getConfirmBackIndicesFromControls(
    controls: FullscreenControls,
    layout: ControllerLayout,
    profile: GamepadProfile
): { confirm: number; back: number } {
    const playIdx = getBindingButtonIndex(controls.play, layout, profile)
    const backIdx = getBindingButtonIndex(controls.back, layout, profile)
    return {
        confirm: playIdx ?? getPhysicalButtonIndex('a', layout, profile),
        back: backIdx ?? getPhysicalButtonIndex('b', layout, profile)
    }
}
