# Windows Store Submission Guide

## ✅ Issues Fixed

Your Windows Store package has been rebuilt with the following corrections:

### 1. **Minimum Windows Version** ✓
- **Before**: MinVersion <= 10.0.17134.0 (not allowed)
- **After**: MinVersion = 10.0.17763.0 (Windows 10 version 1809)
- **Max Tested**: 10.0.22621.0 (Windows 11 22H2)

### 2. **Publisher Display Name** ✓
- **Before**: "Unified Launcher" (didn't match your account)
- **After**: "Supermedo" (matches your Publisher account)
- **Publisher**: CN=Supermedo

## 📦 Package Ready for Upload

**File**: `release/Unified Launcher 1.0.0.appx`

This package is now compliant with Windows Store requirements and should pass validation.

## 🚀 How to Submit

### Step 1: Open Partner Center
1. Go to https://partner.microsoft.com/dashboard
2. Sign in with your Supermedo account
3. Click on "Apps and games"

### Step 2: Create or Select App
1. If new app: Click "+ New product" → "App"
2. Reserve your app name (e.g., "Unified Launcher")
3. If existing app: Click on your app

### Step 3: Prepare Submission
1. Click "Start your submission"
2. Fill in required sections:
   - **Properties**: Age rating, category
   - **Pricing and availability**: Free/Paid, markets
   - **Store listings**: Description, screenshots, etc.

### Step 4: Upload Package
1. Go to "Packages" section
2. Click "Browse" or drag & drop
3. **Upload**: `Unified Launcher 1.0.0.appx`
4. Wait for package validation (should succeed now!)

### Step 5: Store Listing Details

**Description Suggestions**:
```
Unified Launcher - All Your Games in One Place

Manage all your games from different platforms in one beautiful launcher. 
Unified Launcher automatically detects games from Steam, Epic Games, GOG, 
EA App, Ubisoft Connect, and more.

Features:
• Multi-platform game detection
• Beautiful modern UI with multiple themes
• Console-style fullscreen mode with controller support
• Free games browser
• Steam integration
• Custom game collections
• Auto-start with Windows
• Multi-language support (English, Arabic)

Never lose track of your games again!
```

**Categories**: Games, Productivity, Entertainment

**Age Rating**: 3+ or 7+ (depending on game content)

### Step 6: Screenshots Required
You need to provide screenshots for the store listing:
- Minimum: 1 screenshot (1280x720 or larger)
- Recommended: 3-5 screenshots
- Supported formats: PNG, JPG
- Show your app's key features

**Screenshot Ideas**:
1. Main library view with games
2. Fullscreen console mode
3. Free games browser
4. Settings/customization
5. Game details view

### Step 7: Submit for Certification
1. Review all sections (green checkmarks)
2. Click "Submit to the Store"
3. Wait for certification (typically 1-3 business days)

## 🔍 Certification Process

**What Microsoft Checks**:
- Security and malware scan
- Performance testing
- Content policy compliance
- Package validation
- Functionality testing

**Timeline**:
- Initial review: 24-48 hours
- Full certification: 1-3 business days
- If rejected: You'll get detailed feedback

## ✅ Package Details

Your current package includes:

- **App ID**: UnifiedLauncher
- **Identity Name**: UnifiedLauncher  
- **Publisher**: CN=Supermedo
- **Publisher Display Name**: Supermedo
- **Version**: 1.0.0
- **Languages**: English (en-US), Arabic (ar-SA)
- **Target OS**: Windows 10 (17763+) / Windows 11
- **Architecture**: x64

## 📝 Important Notes

1. **Package Signing**:
   - Currently unsigned (normal for Store-only builds)
   - Microsoft will sign it during certification

2. **Updates**:
   - To release updates, increment version in `package.json`
   - Rebuild: `npm run build:win:store`
   - Upload new `.appx` file to Partner Center

3. **Testing Before Submission**:
   - Install the `.appx` locally (requires developer mode)
   - Enable Developer Mode: Settings → Update & Security → For developers
   - Right-click `.appx` → Install

4. **Store Identity**:
   - After first submission, Partner Center provides Package/Identity/Name
   - Update `package.json` "identityName" with this value for future builds

## 🆘 If Validation Still Fails

**Common Issues**:
1. **Publisher mismatch**: Verify your Partner Center publisher name is "Supermedo"
2. **Version conflict**: If you previously uploaded 1.0.0, increment to 1.0.1
3. **Missing capabilities**: Check if app needs special permissions
4. **Icon issues**: Ensure icon.png is valid (256x256+)

**Get Package Identity from Partner Center**:
1. Go to your app in Partner Center
2. Click "Product identity" in left menu
3. Copy these values and update `package.json`:
   ```json
   "identityName": "12345Supermedo.UnifiedLauncher"
   "publisher": "CN=XXXXXXXXXX"
   ```

## 🎉 After Approval

Once approved:
- Your app will be available in Microsoft Store
- Users can search for "Unified Launcher"
- Auto-updates will work through the Store
- You'll see download statistics in Partner Center

---

**Good luck with your submission! 🚀**

Your package is now properly configured and ready to upload.
