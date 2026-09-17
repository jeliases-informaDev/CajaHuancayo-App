Add-Type -AssemblyName System.Drawing

$assetsPath = Join-Path $PSScriptRoot '..\assets'
$sourcePath = Join-Path $assetsPath 'radar-logo.png'
$source = [System.Drawing.Image]::FromFile($sourcePath)

function Save-LogoCanvas {
  param(
    [string]$OutputPath,
    [bool]$Transparent,
    [double]$LogoScale
  )

  $size = 1024
  $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

  if ($Transparent) {
    $graphics.Clear([System.Drawing.Color]::Transparent)
  } else {
    $graphics.Clear([System.Drawing.Color]::White)
  }

  $maxWidth = [int]($size * $LogoScale)
  $maxHeight = [int]($size * $LogoScale)
  $ratio = [Math]::Min($maxWidth / $source.Width, $maxHeight / $source.Height)
  $width = [int]($source.Width * $ratio)
  $height = [int]($source.Height * $ratio)
  $x = [int](($size - $width) / 2)
  $y = [int](($size - $height) / 2)

  $graphics.DrawImage($source, $x, $y, $width, $height)
  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

try {
  Save-LogoCanvas -OutputPath (Join-Path $assetsPath 'icon.png') -Transparent $false -LogoScale 0.66
  Save-LogoCanvas -OutputPath (Join-Path $assetsPath 'android-icon-foreground.png') -Transparent $true -LogoScale 0.54
} finally {
  $source.Dispose()
}
