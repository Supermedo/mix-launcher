# Building Unified Launcher

This guide explains how to build the Unified Launcher for distribution.

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Windows OS (for Windows builds)

## Build Commands

### 1. Standard Windows Installer (NSIS)

Build a standard Windows installer (.exe) with installation wizard:

```bash
npm run build:win
```

This creates:
- `release/Unified Launcher Setup X.X.X.exe` - Installer
- `release/Unified-Launcher-Portable.exe` - Portable version (no installation needed)

### 2. Windows Store (MSIX/AppX)

Build for Windows Store submission:

```bash
npm run build:win:store
```

This creates:
- `release/Unified Launcher X.X.X.appx` - Windows Store package

### 3. Build Everything

Build all Windows targets at once:

```bash
npm run electron:build
```

## Output Directory

All build artifacts are placed in the `release/` directory.

## Distribution

### Regular Distribution (Installer)
1. Run `npm run build:win`
2. Share the `Unified Launcher Setup X.X.X.exe` file
3. Users run the installer and follow the wizard

### Portable Version
1. The portable exe is automatically created with each build
2. Share `Unified-Launcher-Portable.exe`
3. Users can run it directly without installation

### Windows Store Submission

To submit to Windows Store, you need:

1. **Windows Partner Center Account**
   - Sign up at https://partner.microsoft.com/dashboard

2. **App Identity**
   - Reserve your app name in Partner Center
   - Get Publisher ID and Package Identity Name
   - Update `package.json` build.appx section with your values

3. **Code Signing Certificate**
   - Required for MSIX packages
   - Purchase from a Certificate Authority or use Windows Partner Center
   - Update package.json:
     ```json
     "certificateFile": "path/to/your/certificate.pfx",
     "certificatePassword": "your-password"
     ```

4. **Build and Submit**
   ```bash
   npm run build:win:store
   ```
   - Upload the generated .appx file to Partner Center
   - Fill in store listing details
   - Submit for certification

## Icon Requirements

The app uses `build/icon.png` for the app icon.

For best results:
- Size: 256x256 pixels or larger
- Format: PNG with transparency
- Square aspect ratio

## Troubleshooting

### Build Fails
- Make sure all dependencies are installed: `npm install`
- Clean and rebuild: `rm -rf dist dist-electron release && npm run build:win`

### Windows Store Build Fails
- Ensure you have proper publisher identity in package.json
- Check that your certificate is valid and not expired
- Verify Node.js version is compatible

### Icon Issues
- Make sure `build/icon.png` exists
- Icon should be at least 256x256 pixels
- Use PNG format

## Development Build

For testing without creating installers:

```bash
npm run dev
```

This starts the development server with hot reload.
