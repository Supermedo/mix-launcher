# Bundled Legendary (Epic library sync)

The Windows installer includes `legendary.exe` here so users do not install Python or pip.

**For developers building a release:**

```powershell
npm run fetch:legendary
npm run build:win
```

Legendary is GPL-3.0. Source: https://github.com/legendary-gl/legendary

If `legendary.exe` is missing from the installer, the app can download it once on first Epic sync (stored in user data).
