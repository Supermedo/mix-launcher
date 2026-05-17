# Generate Windows Store Logos from Icon
# This script creates all required store logo sizes from your icon

Write-Host "Generating Windows Store Logos..." -ForegroundColor Cyan
Write-Host ""

# Check if icon exists
$sourceIcon = "build\icon.png"
if (-not (Test-Path $sourceIcon)) {
    Write-Host "ERROR: Icon not found at $sourceIcon" -ForegroundColor Red
    Write-Host "Please make sure build\icon.png exists" -ForegroundColor Yellow
    exit 1
}

# Create output directory
$outputDir = "build\appx"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
    Write-Host "Created output directory: $outputDir" -ForegroundColor Green
}

# Load System.Drawing for image manipulation
Add-Type -AssemblyName System.Drawing

# Function to resize image
function Resize-Image {
    param (
        [string]$SourcePath,
        [string]$TargetPath,
        [int]$Width,
        [int]$Height,
        [bool]$MaintainAspect = $true
    )
    
    try {
        $img = [System.Drawing.Image]::FromFile((Get-Item $SourcePath).FullName)
        $bitmap = New-Object System.Drawing.Bitmap($Width, $Height)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        
        # High quality settings
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

        # Clear background (transparent)
        $graphics.Clear([System.Drawing.Color]::Transparent)
        
        if ($MaintainAspect) {
             # Calculate dimensions to fit within target while maintaining aspect ratio
            $ratioX = $Width / $img.Width
            $ratioY = $Height / $img.Height
            $ratio = [Math]::Min($ratioX, $ratioY)

            $newWidth = [int]($img.Width * $ratio)
            $newHeight = [int]($img.Height * $ratio)

            # Center the image
            $posX = [int](($Width - $newWidth) / 2)
            $posY = [int](($Height - $newHeight) / 2)

            $graphics.DrawImage($img, $posX, $posY, $newWidth, $newHeight)
        }
        else {
             $graphics.DrawImage($img, 0, 0, $Width, $Height)
        }
        
        $bitmap.Save($TargetPath, [System.Drawing.Imaging.ImageFormat]::Png)
        
        $graphics.Dispose()
        $bitmap.Dispose()
        $img.Dispose()
        
        return $true
    }
    catch {
        Write-Host "❌ Error creating ${Width}x${Height}: $_" -ForegroundColor Red
        return $false
    }
}

# Store logo sizes required for AppX (Electron Builder / Windows Store)
$sizes = @(
    @{ Width = 44; Height = 44; Name = "Square44x44Logo.png"; Description = "App list icon (44x44)" },
    @{ Width = 50; Height = 50; Name = "StoreLogo.png"; Description = "Store logo (50x50)" },
    @{ Width = 71; Height = 71; Name = "Square71x71Logo.png"; Description = "Small tile (71x71)" },
    @{ Width = 150; Height = 150; Name = "Square150x150Logo.png"; Description = "Medium tile (150x150)" },
    @{ Width = 310; Height = 150; Name = "Wide310x150Logo.png"; Description = "Wide tile (310x150)" },
    @{ Width = 310; Height = 310; Name = "Square310x310Logo.png"; Description = "Large tile (310x310)" }
)

Write-Host "Creating required store logo sizes..." -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$totalCount = $sizes.Count

foreach ($size in $sizes) {
    $targetPath = Join-Path $outputDir $size.Name
    $sizeText = "$($size.Width)x$($size.Height)"
    Write-Host "  Creating $($size.Name) ($sizeText)... " -NoNewline
    
    if (Resize-Image -SourcePath $sourceIcon -TargetPath $targetPath -Width $size.Width -Height $size.Height) {
        Write-Host "OK" -ForegroundColor Green
        Write-Host "    - $($size.Description)" -ForegroundColor Gray
        $successCount++
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Done! Generated $successCount of $totalCount logos" -ForegroundColor Green
Write-Host ""
Write-Host "Output directory: $outputDir" -ForegroundColor Yellow
Write-Host ""
Write-Host "Files created:" -ForegroundColor Cyan
Get-ChildItem $outputDir -Filter *.png | ForEach-Object {
    $imgSize = [System.Drawing.Image]::FromFile($_.FullName)
    Write-Host "  - $($_.Name) - $($imgSize.Width)x$($imgSize.Height) pixels" -ForegroundColor White
    $imgSize.Dispose()
}
Write-Host ""
Write-Host "Next Step:" -ForegroundColor Yellow
Write-Host "  Run 'npm run build:win:store' to build the AppX package with these assets." -ForegroundColor White
Write-Host ""
