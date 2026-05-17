import { APP_NAME } from '../constants/app'

export async function showAppMessage(
    message: string,
    options?: { title?: string; type?: 'info' | 'warning' | 'error' }
): Promise<void> {
    if (window.electronAPI?.showMessage) {
        await window.electronAPI.showMessage({
            message,
            title: options?.title ?? APP_NAME,
            type: options?.type
        })
        return
    }
    alert(message)
}
