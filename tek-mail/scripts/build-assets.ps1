$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'public\assets'
New-Item -ItemType Directory -Path $assetDir -Force | Out-Null
foreach ($size in @(16,32,64,80,128)) {
    $bitmap = New-Object System.Drawing.Bitmap $size,$size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::FromArgb(49,92,66))
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(246,249,242)),([float]($size / 18))
    $x = [float]($size * 0.2); $y = [float]($size * 0.3); $w = [float]($size * 0.6); $h = [float]($size * 0.4)
    $graphics.DrawRectangle($pen, $x, $y, $w, $h)
    $graphics.DrawLine($pen, $x, $y, [float]($size / 2), [float]($size * 0.54))
    $graphics.DrawLine($pen, [float]($x + $w), $y, [float]($size / 2), [float]($size * 0.54))
    $bitmap.Save((Join-Path $assetDir "icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $pen.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
