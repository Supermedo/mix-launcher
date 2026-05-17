import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'
import fs from 'fs'

function copyElectronAssetsFiles() {
    const destDir = path.resolve(__dirname, 'dist-electron')
    const scriptsDir = path.join(destDir, 'scripts')
    for (const name of ['scan-xbox-games.ps1', 'read-gog-library.mjs']) {
        const src = path.resolve(__dirname, 'electron/scripts', name)
        if (fs.existsSync(src)) {
            fs.mkdirSync(scriptsDir, { recursive: true })
            fs.copyFileSync(src, path.join(scriptsDir, name))
        }
    }

    const wasmSrc = path.resolve(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm')
    if (fs.existsSync(wasmSrc)) {
        fs.mkdirSync(destDir, { recursive: true })
        fs.copyFileSync(wasmSrc, path.join(destDir, 'sql-wasm.wasm'))
    }
}

function copyElectronAssetsPlugin() {
    return {
        name: 'copy-electron-assets',
        buildStart: copyElectronAssetsFiles,
        closeBundle: copyElectronAssetsFiles
    }
}

export default defineConfig({
    // Avoid node_modules/.vite — often locked on Windows (AV, Explorer, stale dev server).
    cacheDir: path.resolve(__dirname, '.vite-cache'),
    plugins: [
        react(),
        electron([
            {
                entry: 'electron/main.ts',
                vite: {
                    plugins: [copyElectronAssetsPlugin()],
                    build: {
                        outDir: 'dist-electron'
                    },
                    onstart() {
                        copyElectronAssetsFiles()
                    }
                }
            },
            {
                entry: 'electron/preload.ts',
                onstart(options) {
                    copyElectronAssetsFiles()
                    options.reload()
                },
                vite: {
                    build: {
                        outDir: 'dist-electron'
                    }
                }
            }
        ]),
        renderer()
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },
    server: {
        port: 5175
    },
    build: {
        outDir: 'dist',
        // Windows: dist/assets is often locked (Explorer preview, running Electron, AV).
        // Overwrite files in place instead of deleting the folder first.
        emptyOutDir: false
    }
})
