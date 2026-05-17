import { useCallback, useRef } from 'react'

/** Single vs double tap/click (touch-friendly play on handheld). */
export function useDoubleTap(
    onSingle: () => void,
    onDouble: () => void,
    delayMs = 280
) {
    const lastTapRef = useRef(0)
    const timerRef = useRef<ReturnType<typeof setTimeout>>()

    return useCallback(() => {
        const now = Date.now()
        if (now - lastTapRef.current < delayMs) {
            if (timerRef.current) clearTimeout(timerRef.current)
            lastTapRef.current = 0
            onDouble()
            return
        }
        lastTapRef.current = now
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
            onSingle()
            lastTapRef.current = 0
        }, delayMs)
    }, [onSingle, onDouble, delayMs])
}
