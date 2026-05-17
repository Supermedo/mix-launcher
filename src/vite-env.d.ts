/// <reference types="vite/client" />

declare global {
    interface Window {
        close: () => void;
        toggleFullscreen: (flag?: boolean) => void;
    }
}
