import type { ControllerLayout } from './game'

/** Physical / logical gamepad inputs for Big Picture bindings. */
export type FullscreenGamepadButton =
    | 'a'
    | 'b'
    | 'x'
    | 'y'
    | 'lb'
    | 'rb'
    | 'lt'
    | 'rt'
    | 'start'
    | 'select'
    | 'dpadUp'
    | 'dpadDown'
    | 'dpadLeft'
    | 'dpadRight'

export type FullscreenControlBinding = FullscreenGamepadButton | 'none'

export type FullscreenControlAction =
    | 'play'
    | 'back'
    | 'toggleView'
    | 'quickMenu'
    | 'settings'
    | 'addGame'
    | 'prevTab'
    | 'nextTab'
    | 'prevGame'
    | 'nextGame'

export interface FullscreenControls {
    play: FullscreenControlBinding
    back: FullscreenControlBinding
    toggleView: FullscreenControlBinding
    quickMenu: FullscreenControlBinding
    settings: FullscreenControlBinding
    addGame: FullscreenControlBinding
    prevTab: FullscreenControlBinding
    nextTab: FullscreenControlBinding
    prevGame: FullscreenControlBinding
    nextGame: FullscreenControlBinding
}

export const FULLSCREEN_CONTROL_ACTIONS: FullscreenControlAction[] = [
    'play',
    'back',
    'toggleView',
    'quickMenu',
    'settings',
    'addGame',
    'prevTab',
    'nextTab',
    'prevGame',
    'nextGame'
]

export const FULLSCREEN_GAMEPAD_BUTTONS: FullscreenGamepadButton[] = [
    'a',
    'b',
    'x',
    'y',
    'lb',
    'rb',
    'lt',
    'rt',
    'start',
    'select',
    'dpadUp',
    'dpadDown',
    'dpadLeft',
    'dpadRight'
]

export const DEFAULT_FULLSCREEN_CONTROLS: FullscreenControls = {
    play: 'a',
    back: 'b',
    toggleView: 'x',
    quickMenu: 'y',
    settings: 'start',
    addGame: 'none',
    prevTab: 'lb',
    nextTab: 'rb',
    prevGame: 'dpadLeft',
    nextGame: 'dpadRight'
}

export function mergeFullscreenControls(
    partial?: Partial<FullscreenControls> | null
): FullscreenControls {
    return { ...DEFAULT_FULLSCREEN_CONTROLS, ...partial }
}

/** Button label shown in settings (respects Xbox vs Nintendo face names). */
export function fullscreenButtonLabel(
    button: FullscreenGamepadButton,
    layout: ControllerLayout
): string {
    if (layout === 'nintendo') {
        const labels: Record<FullscreenGamepadButton, string> = {
            a: 'A',
            b: 'B',
            x: 'X',
            y: 'Y',
            lb: 'L',
            rb: 'R',
            lt: 'ZL',
            rt: 'ZR',
            start: '+',
            select: '-',
            dpadUp: 'D-Up',
            dpadDown: 'D-Down',
            dpadLeft: 'D-Left',
            dpadRight: 'D-Right'
        }
        return labels[button]
    }
    const labels: Record<FullscreenGamepadButton, string> = {
        a: 'A',
        b: 'B',
        x: 'X',
        y: 'Y',
        lb: 'LB',
        rb: 'RB',
        lt: 'LT',
        rt: 'RT',
        start: 'Start',
        select: 'Select',
        dpadUp: 'D-Up',
        dpadDown: 'D-Down',
        dpadLeft: 'D-Left',
        dpadRight: 'D-Right'
    }
    return labels[button]
}
