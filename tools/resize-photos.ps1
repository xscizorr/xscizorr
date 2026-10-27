<#
  Makes web-sized copies of card or slab photos for the website.

  For every photo it writes:
    images/cards/<name>.jpg          1000 px tall, used in the card pop-up and the homepage carousel
    images/cards/thumbs/<name>.jpg   440 px tall, used in the collection grid

  Examples (run from the project folder):
    powershell -ExecutionPolicy Bypass -File tools\resize-photos.ps1 -Src "C:\path\to\scans"
    powershell -ExecutionPolicy Bypass -File tools\resize-photos.ps1 -Src "C:\path\to\scans" -Names scizor003,scizor005

  Options:
    -NoThumbs   skip the small copy (use it for slab backs, which only appear in the card pop-up)
    -Mono       black and white with a dark vignette (used for cards that are still on the way)

  <name> is the file name without spaces, e.g. "scizor 157.jpg" becomes "scizor157".
  Then link each photo to its card in data/photos.js.
#>
param(
  [Parameter(Mandatory = $true)][string]$Src,
  [string[]]$Names = @(),
  [int]$Height = 1000,
  [int]$ThumbHeight = 440,
  [switch]$NoThumbs,
  [switch]$Mono
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
public static class PhotoFx {
  // Black and white with a slight contrast lift and a smooth dark vignette towards the edges. Transparency is kept.
  public static void MonoVignette(Bitmap bmp, double strength) {
    var rect = new Rectangle(0, 0, bmp.Width, bmp.Height);
    var data = bmp.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    int bytes = data.Stride * bmp.Height;
    var px = new byte[bytes];
    Marshal.Copy(data.Scan0, px, 0, bytes);
    double cx = bmp.Width / 2.0, cy = bmp.Height / 2.0, diag = Math.Sqrt(2.0);
    for (int y = 0; y < bmp.Height; y++) {
      for (int x = 0; x < bmp.Width; x++) {
        int i = y * data.Stride + x * 4;
        double lum = 0.2126 * px[i + 2] + 0.7152 * px[i + 1] + 0.0722 * px[i];
        lum = ((lum / 255.0 - 0.5) * 1.08 + 0.5) * 255.0;
        double dx = (x - cx) / cx, dy = (y - cy) / cy;
        double d = Math.Sqrt(dx * dx + dy * dy) / diag;
        double t = Math.Max(0.0, Math.Min(1.0, (d - 0.35) / 0.65));
        t = t * t * (3 - 2 * t);
        byte v = (byte)Math.Max(0, Math.Min(255, Math.Round(lum * (1 - strength * t))));
        px[i] = v; px[i + 1] = v; px[i + 2] = v;
      }
    }
    Marshal.Copy(px, 0, data.Scan0, bytes);
    bmp.UnlockBits(data);
  }
}
'@

# Windows' built-in image library can't read WebP, so fall back to the WPF decoder for those
function Open-Image([string]$path) {
  try { return [System.Drawing.Image]::FromFile($path) } catch {}
  Add-Type -AssemblyName PresentationCore, WindowsBase
  $dec = [System.Windows.Media.Imaging.BitmapDecoder]::Create((New-Object Uri($path)), [System.Windows.Media.Imaging.BitmapCreateOptions]::None, [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad)
  $enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
  $enc.Frames.Add($dec.Frames[0])
  $ms = New-Object IO.MemoryStream
  $enc.Save($ms); $ms.Position = 0
  return [System.Drawing.Image]::FromStream($ms)
}
$root = Split-Path -Parent $PSScriptRoot
$big = Join-Path $root 'images\cards'
$small = Join-Path $big 'thumbs'
New-Item -ItemType Directory -Force -Path $big, $small | Out-Null

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
function Save-Jpeg($img, [int]$h, [string]$dest, [long]$quality) {
  $h = [Math]::Min($h, $img.Height)
  $w = [int][Math]::Round($img.Width * $h / $img.Height)
  $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.SmoothingMode = 'HighQuality'; $g.PixelOffsetMode = 'HighQuality'
  $g.DrawImage($img, 0, 0, $w, $h)
  $g.Dispose()
  if ($Mono) { [PhotoFx]::MonoVignette($bmp, 0.6) }
  # JPEG has no transparency: put the result on white
  $out = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.Clear([System.Drawing.Color]::White)
  $g.DrawImage($bmp, 0, 0, $w, $h)
  $g.Dispose(); $bmp.Dispose()
  $p = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $p.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, $quality)
  $out.Save($dest, $codec, $p)
  $out.Dispose()
}

$want = @{}
$Names | ForEach-Object { $_ -split ',' } | Where-Object { $_.Trim() } | ForEach-Object { $want[($_ -replace '\s', '').ToLower()] = $true }
$done = 0
foreach ($f in Get-ChildItem -LiteralPath $Src -File | Where-Object { $_.Extension -match '^\.(jpe?g|png|webp|tiff?|bmp|gif)$' }) {
  $name = ($f.BaseName -replace '\s', '').ToLower()
  if ($want.Count -and -not $want.ContainsKey($name)) { continue }
  $img = Open-Image $f.FullName
  try {
    Save-Jpeg $img $Height (Join-Path $big "$name.jpg") 84
    if (-not $NoThumbs) { Save-Jpeg $img $ThumbHeight (Join-Path $small "$name.jpg") 80 }
  } finally { $img.Dispose() }
  $done++
}
$size = (Get-ChildItem $big, $small -File | Measure-Object Length -Sum).Sum / 1MB
Write-Host ("Resized {0} photo(s). images/cards now holds {1:N1} MB." -f $done, $size)
