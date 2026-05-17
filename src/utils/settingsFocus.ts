/** Collect visible, enabled controls inside a modal for gamepad focus. */
export function getModalFocusables(root: HTMLElement | null): HTMLElement[] {
    if (!root) return []

    return Array.from(
        root.querySelectorAll<HTMLElement>(
            'button:not([disabled]):not([hidden]), select:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled])'
        )
    ).filter(el => {
        if (el.offsetParent === null) return false
        const style = window.getComputedStyle(el)
        return style.visibility !== 'hidden' && style.display !== 'none'
    })
}

export function cycleSelectValue(select: HTMLSelectElement, direction: 'left' | 'right'): void {
    const count = select.options.length
    if (count <= 1) return
    const delta = direction === 'right' ? 1 : -1
    select.selectedIndex = (select.selectedIndex + delta + count) % count
    select.dispatchEvent(new Event('change', { bubbles: true }))
}

export function activateFocusable(el: HTMLElement): void {
    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
        el.checked = !el.checked
        el.dispatchEvent(new Event('change', { bubbles: true }))
        return
    }
    el.click()
}

export function applySettingsFocusRing(items: HTMLElement[], index: number): void {
    items.forEach(el => el.classList.remove('settings-item-focus'))
    const el = items[index]
    if (el) {
        el.classList.add('settings-item-focus')
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
}
