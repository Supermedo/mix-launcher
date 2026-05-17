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

<img width="2548" height="1430" alt="Screenshot 2026-05-17 151939" src="https://github.com/user-attachments/assets/ccb1c60b-d39c-46f6-84b8-1af3025cf7ef" />
<img width="2552" height="1430" alt="Screenshot 2026-05-17 151924" src="https://github.com/user-attachments/assets/868b7eb3-c834-48a8-90f9-0c606a9e617f" />
<img width="2551" height="1361" alt="Screenshot 2026-05-17 151842" src="https://github.com/user-attachments/assets/9b3e0b64-6bd9-4a3a-972d-195c208abc80" />
<img width="762" height="1177" alt="Screenshot 2026-05-17 151907" src="https://github.com/user-attachments/assets/62c1068d-224d-423e-96a5-8016a35e23ff" />
<img width="758" height="1161" alt="Screenshot 2026-05-17 151851" src="https://github.com/user-attachments/assets/6d3d876b-86e8-4990-9cc8-fac30248f091" />

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
