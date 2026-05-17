# Mix Launcher

**Repository:** https://github.com/Supermedo/mix-launcher

All your PC games in one place — Steam, Epic, GOG, Xbox, EA, Ubisoft, Amazon, cloud links, and manual shortcuts.

Built with **Electron**, **React**, and **TypeScript** for Windows.

## Features

- Unified library scan and optional full-library sync (Steam, Epic via Legendary, GOG Galaxy)
- Desktop grid + **Big Picture** fullscreen mode with gamepad support
- Handheld-friendly options (TDP presets, minimize on play, battery display)
- Collections, favorites, recent play, metadata scraping
- English and Arabic UI

## Development

```bash
npm install
npm run dev
```

## Build Windows installer / portable exe

```bash
npm run fetch:legendary   # once — bundles Epic sync tool
npm run build:win
```

Output: `release-build/` — `Mix-Launcher-Portable.exe` and `Mix Launcher Setup 1.0.0.exe`.

If a rebuild fails with “file in use”, close the app and run `npm run build:win:fresh`.

## License

See [LICENSE.txt](LICENSE.txt).
