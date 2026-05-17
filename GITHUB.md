# Publish Mix Launcher to GitHub

## Quick way (recommended)

1. Close **Mix Launcher** and any File Explorer window on this folder.
2. Open **PowerShell** in this folder.
3. Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-github.ps1
```

4. On GitHub: [Create a new repository](https://github.com/new)
   - Name: `mix-launcher`
   - Do **not** initialize with README (you already have one)

5. Push (replace `YOUR_USER`):

```powershell
& "C:\Program Files\Git\bin\git.exe" remote add origin https://github.com/YOUR_USER/mix-launcher.git
& "C:\Program Files\Git\bin\git.exe" push -u origin main
```

## What is not uploaded

`.gitignore` excludes:

- `node_modules/`
- `dist/`, `dist-electron/`
- `release-build/`, `release-build-fresh/`, `release1/`
- `resources/legendary/legendary.exe` (large; users run `npm run fetch:legendary` when building)

## If push fails

- **Permission / index errors**: Close Cursor, run the setup script again in a normal PowerShell window.
- **Authentication**: Use a [Personal Access Token](https://github.com/settings/tokens) as the password when Git asks, or install GitHub CLI: `winget install GitHub.cli` then `gh auth login`.
