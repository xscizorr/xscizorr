<#
  Rebuilds the site's card database from the Scizor Google Sheet.

  What it does:
    1. Downloads the sheet as .xlsx (or uses -XlsxPath if you pass a local file)
    2. Reads both tabs (ENGJPN and MULTI-LANGUAGE TCG)
    3. Saves the artwork crops to assets/art and the set symbols to assets/sets
    4. Writes data/cards.js, which the website loads

  Run it from the project folder:
    powershell -ExecutionPolicy Bypass -File tools\import-sheet.ps1

  Anything you changed on the website itself (statuses, prices, photos) is kept:
  those edits live in your browser and are matched to cards by their id.
#>
param(
  [string]$SheetId = '1vzmtjoh6YpiwGkOVtLY4YGvHxLEXeB4Sp-4xroV5n1U',
  [string]$XlsxPath = ''
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$tmp = Join-Path ([IO.Path]::GetTempPath()) ('scizor-import-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)

# ---------------------------------------------------------------- download + unzip
$zip = Join-Path $tmp 'sheet.zip'
if ($XlsxPath) {
  Copy-Item $XlsxPath $zip
} else {
  Write-Host 'Downloading the Google Sheet...'
  Invoke-WebRequest -UseBasicParsing -Uri "https://docs.google.com/spreadsheets/d/$SheetId/export?format=xlsx" -OutFile $zip
}
$x = Join-Path $tmp 'x'
Expand-Archive -Path $zip -DestinationPath $x -Force
$xl = Join-Path $x 'xl'

function Read-Xml([string]$path) { [xml]([IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)) }

# ---------------------------------------------------------------- workbook plumbing
$strings = @()
$ssPath = Join-Path $xl 'sharedStrings.xml'
if (Test-Path $ssPath) { $strings = @((Read-Xml $ssPath).sst.si | ForEach-Object { $_.InnerText }) }

function Get-ColIndex([string]$ref) {
  $letters = ($ref -replace '\d', '').ToUpper(); $n = 0
  foreach ($ch in $letters.ToCharArray()) { $n = $n * 26 + ([int][char]$ch - 64) }
  return $n - 1   # A = 0
}

# Map sheet name -> worksheet xml path
$wb = Read-Xml (Join-Path $xl 'workbook.xml')
$wbRels = @{}
(Read-Xml (Join-Path $xl '_rels\workbook.xml.rels')).Relationships.Relationship | ForEach-Object { $wbRels[$_.Id] = $_.Target }
$sheetFiles = @{}
foreach ($s in $wb.workbook.sheets.sheet) {
  $rid = $s.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
  $sheetFiles[$s.name] = Join-Path $xl ($wbRels[$rid] -replace '/', '\')
}

# Number formats, so numeric cells come back as the text shown in the sheet.
# Google Sheets turns a card number like "8/19" into a date, and "33" into 33.0.
$numFmtOfStyle = @()
$customFmts = @{}
$stylesPath = Join-Path $xl 'styles.xml'
if (Test-Path $stylesPath) {
  $styles = Read-Xml $stylesPath
  if ($styles.styleSheet.numFmts) { $styles.styleSheet.numFmts.numFmt | ForEach-Object { $customFmts[[int]$_.numFmtId] = $_.formatCode } }
  $numFmtOfStyle = @($styles.styleSheet.cellXfs.xf | ForEach-Object { [int]$_.numFmtId })
}
$inv = [Globalization.CultureInfo]::InvariantCulture
function Format-Number([string]$raw, $styleIndex) {
  $n = 0.0
  if (-not [double]::TryParse($raw, [Globalization.NumberStyles]::Float, $inv, [ref]$n)) { return $raw }
  $fmtId = if ($styleIndex -ne $null -and [int]$styleIndex -lt $numFmtOfStyle.Count) { $numFmtOfStyle[[int]$styleIndex] } else { 0 }
  $code = if ($customFmts.ContainsKey($fmtId)) { $customFmts[$fmtId] } else { '' }
  $isDate = ($fmtId -ge 14 -and $fmtId -le 22) -or ($fmtId -ge 45 -and $fmtId -le 47) -or ($code -and ($code -replace '"[^"]*"|\[[^\]]*\]', '') -match '[dmy]')
  if ($isDate -and $n -gt 0) {
    $dt = [DateTime]::FromOADate($n)
    if ($code -match 'y') { return $dt.ToString('M/d/yyyy', $inv) }
    return $dt.ToString('M/d', $inv)
  }
  if ($n -eq [Math]::Floor($n)) { return ([long]$n).ToString($inv) }
  return $n.ToString($inv)
}

# Returns @{ rowNumber = @{ colIndex = 'text' } }
function Read-Sheet([string]$path) {
  $doc = Read-Xml $path
  $rows = @{}
  foreach ($r in $doc.worksheet.sheetData.row) {
    $cells = @{}
    foreach ($c in $r.c) {
      $v = $null
      if ($c.t -eq 's') { $v = $strings[[int]$c.v] }
      elseif ($c.t -eq 'inlineStr') { $v = $c.is.InnerText }
      elseif ($c.t -eq 'str' -or $c.t -eq 'b' -or $c.t -eq 'e') { $v = [string]$c.v }
      elseif ($c.v) { $v = Format-Number ([string]$c.v) $c.s }
      if ($v -ne $null -and $v.Trim() -ne '') { $cells[(Get-ColIndex $c.r)] = $v }
    }
    if ($cells.Count) { $rows[[int]$r.r] = $cells }
  }
  return $rows
}

# Returns a list of @{ row (1-based); col (0-based); file (full path) } for each picture
function Read-Pictures([string]$sheetPath) {
  $relsPath = Join-Path (Split-Path $sheetPath) ('_rels\' + (Split-Path $sheetPath -Leaf) + '.rels')
  if (-not (Test-Path $relsPath)) { return @() }
  $drawRel = (Read-Xml $relsPath).Relationships.Relationship | Where-Object { $_.Type -like '*/drawing' } | Select-Object -First 1
  if (-not $drawRel) { return @() }
  $drawPath = [IO.Path]::GetFullPath((Join-Path (Split-Path $sheetPath) $drawRel.Target))
  $dRels = @{}
  (Read-Xml (Join-Path (Split-Path $drawPath) ('_rels\' + (Split-Path $drawPath -Leaf) + '.rels'))).Relationships.Relationship | ForEach-Object { $dRels[$_.Id] = $_.Target }
  $d = Read-Xml $drawPath
  $ns = New-Object System.Xml.XmlNamespaceManager($d.NameTable)
  $ns.AddNamespace('xdr', 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing')
  $ns.AddNamespace('a', 'http://schemas.openxmlformats.org/drawingml/2006/main')
  $out = @()
  foreach ($anchor in $d.SelectNodes('//xdr:oneCellAnchor|//xdr:twoCellAnchor', $ns)) {
    $blip = $anchor.SelectSingleNode('.//a:blip', $ns); if (-not $blip) { continue }
    $rid = $blip.GetAttribute('embed', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
    $out += @{
      row  = [int]$anchor.SelectSingleNode('xdr:from/xdr:row', $ns).InnerText + 1
      col  = [int]$anchor.SelectSingleNode('xdr:from/xdr:col', $ns).InnerText
      file = [IO.Path]::GetFullPath((Join-Path (Split-Path $drawPath) $dRels[$rid]))
    }
  }
  return $out
}

# ---------------------------------------------------------------- text clean-up
$UPPER = @('gx', 'vs', 'pcg', 'ued', 'sv', 'sm', 'vmax', 'vstar', 'ar', 'ir', 'sr', 'hr', 'rr', 'rrr', 'ssr', 'ur', 'chr', 'csr', 'tcg', 'psa', 'cgc', 'ed', 'v', 's', 'r', 'ii')
$SMALL = @('of', 'the', 'and', 'from', 'in', 'to', 'a', 'on', 'for')
$SET_FIX = @{
  'corocoro promo' = 'CoroCoro Promo'
  'mcdonalds promo' = "McDonald's Promo"
  'world championship intimiation deck' = 'World Championship Intimidation Deck'
  'shiny treausre' = 'Shiny Treasure ex'
  'shiny treasure' = 'Shiny Treasure ex'
  'best of the game' = 'Best of Game'
  'rocket gang strikes back - 1st ed' = 'Rocket Gang Strikes Back'
  'rocket gang strikes back - ued' = 'Rocket Gang Strikes Back'
  'bouns round csv4c' = 'Bonus Round'
  'travel special pack csvl2c' = 'Travel Special Pack'
  'shiny treasure sv4af' = 'Shiny Treasure ex'
  'ruler of the black flame sv3f' = 'Ruler of the Black Flame'
  'vivd portrayals: obsidian' = 'Vivid Portrayals: Obsidian'
  'chinese scarlet violet promos' = 'Scarlet & Violet Promos'
  'shiny treasure ex' = 'Shiny Treasure ex'
  'super burst impact' = 'Super-Burst Impact'
}
$VARIANT_FIX = @{
  'non holo' = 'Non-Holo'; 'rev holo' = 'Reverse Holo'; 'reverse holo' = 'Reverse Holo'
  'non holo promo' = 'Non-Holo Promo'; 'reverse pokeball holo' = ('Reverse Pok' + [char]0xE9 + ' Ball Holo')
  'reverse masterball holo' = 'Reverse Master Ball Holo'
}

# Card numbers corrected from the slab labels: "language|set|number as in the sheet|card type" = right number.
# Once the sheet itself is fixed these simply stop matching, and the card keeps the same id either way.
$NUM_FIX = @{
  'JA|McDonald''s Promo|0378/P|Promo' = '037/P'
  'JA|Champion Road|71/88|Full Art' = '71/66'
  'JA|Infinity Zone|113/100|Full Art' = '107/100'
  'JA|Rage of the Broken Heavens|87/80|1st Edition {0} Non-Holo' = '76/80'
  'JA|Rage of the Broken Heavens|87/80|Unlimited {0} Non-Holo' = '76/80'
  # Korean prints share the Japanese numbering
  'KO|Infinity Zone|113/100|SR' = '107/100'
  'KO|Rage of the Broken Heavens|87/80|Non-Holo' = '76/80'
  'KO|Rage of the Broken Heavens|87/80|Holo' = '58/80'
  'KO|Rage of the Broken Heavens|120/122|Full Art' = '87/80'
}
$NUM_FIX = $NUM_FIX.GetEnumerator() | ForEach-Object -Begin { $h = @{} } -Process { $h[($_.Key -f [char]0xB7)] = $_.Value } -End { $h }

function Clean([string]$s) { if ($s -eq $null) { return '' }; return ($s -replace '\s+', ' ').Trim() }

$FirstLetter = [regex]'\p{Ll}'
function Title-Word([string]$w, [bool]$first, [bool]$shoutToTitle) {
  if ($w -eq '') { return $w }
  $lower = $w.ToLower()
  if ($UPPER -contains $lower) { return $w.ToUpper() }
  if ($w -match '^\d') { return $lower }                   # 1st, 30th, 2025
  if ($w -cmatch '^\p{Lu}[\p{Lu}\d]+$') {
    if ($shoutToTitle -and $w.Length -gt 3) { return $w.Substring(0, 1) + $w.Substring(1).ToLower() }
    return $w
  }
  if ($w -cne $lower) { return $w }                       # already has capitals: leave it alone
  if (-not $first -and $SMALL -contains $lower) { return $lower }
  return $FirstLetter.Replace($w, [Text.RegularExpressions.MatchEvaluator] { param($m) $m.Value.ToUpper() }, 1)
}

function Title-Case([string]$s, [bool]$shoutToTitle = $false) {
  $words = $s -split ' '
  $out = for ($i = 0; $i -lt $words.Count; $i++) {
    $parts = $words[$i] -split '-'
    ($parts | ForEach-Object -Begin { $j = 0 } -Process { Title-Word $_ ($i -eq 0 -and $j -eq 0) $shoutToTitle; $j++ }) -join '-'
  }
  return ($out -join ' ')
}

# Thai, Hangul, kana and CJK (kept ASCII-only so Windows PowerShell reads this file correctly)
function Has-NonLatin([string]$s) { return $s -match '[\p{IsThai}\p{IsHangulJamo}\p{IsHiragana}\p{IsKatakana}\p{IsHangulCompatibilityJamo}\p{IsCJKUnifiedIdeographs}\p{IsHangulSyllables}]' }

# Returns @(set, native)
function Clean-Set([string]$raw) {
  $s = Clean $raw; $native = ''
  if ($s -match '^(.*?)\s*\((.+?)\)\s*$') {
    $a = Clean $Matches[1]; $b = Clean $Matches[2]
    if ((Has-NonLatin $a) -and -not (Has-NonLatin $b)) { $s = $b; $native = $a } else { $s = $a; $native = $b }
  }
  $key = $s.ToLower()
  if ($SET_FIX.ContainsKey($key)) { $s = $SET_FIX[$key] }
  else {
    $s = Title-Case $s
    if ($s -cmatch '^Ex ') { $s = 'EX ' + $s.Substring(3) }
  }
  if ($native -and -not (Has-NonLatin $native)) { $native = Title-Case $native }
  return @($s, $native)
}

function Clean-Variant([string]$raw) {
  $s = Clean $raw
  $parts = $s -split '\s+-\s+' | ForEach-Object {
    $p = Clean $_; $k = $p.ToLower()
    if ($VARIANT_FIX.ContainsKey($k)) { $VARIANT_FIX[$k] }
    elseif ($k -match '^(.*)\b(non holo)\b(.*)$') { Title-Case ($k -replace 'non holo', 'non-holo') $true }
    else { Title-Case $p $true }
  }
  return ($parts -join (' ' + [char]0xB7 + ' '))
}

function Clean-Number([string]$raw) {
  $s = Clean $raw
  if ($s -match '^\d+\.\d+$') { $s = $s -replace '\.', '/' }
  return $s
}

# 'PSA 9' -> obtained / PSA 9, 'Ordered' -> in transit, etc.
function Parse-Status([string]$raw) {
  $s = Clean $raw; $k = $s.ToLower()
  if ($k -match '^(unobtained|need|needed|missing)$') { return @('un', '') }
  if ($k -match '^(on the way|ordered|in transit|shipping)$') { return @('tr', '') }
  if ($k -match '^obtained\s*(.*)$') { $g = Clean $Matches[1]; if ($g -eq '') { $g = '' } elseif ($g -match '^raw$') { $g = 'Raw' } else { $g = $g.ToUpper() }; return @('ob', $g) }
  if ($k -eq 'raw') { return @('ob', 'Raw') }
  if ($k -match '^(psa|cgc|bgs|ace|tag|beckett)') { $n = $Matches[1].Length; return @('ob', ($s.Substring(0, $n).ToUpper() + $s.Substring($n))) }
  if ($k -eq '') { return @('un', '') }
  return @('ob', $s)
}

function Get-Hash([string]$s) {
  $h = [uint64]2166136261
  foreach ($b in $utf8.GetBytes($s)) { $h = (($h -bxor [uint64]$b) * [uint64]16777619) % [uint64]4294967296 }
  return $h.ToString('x8')
}

# ---------------------------------------------------------------- images
$artDir = Join-Path $root 'assets\art'
$setDir = Join-Path $root 'assets\sets'
New-Item -ItemType Directory -Force -Path $artDir, $setDir | Out-Null
Get-ChildItem $artDir, $setDir -File | Remove-Item -Force

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
function Save-Resized([string]$src, [string]$dest, [int]$maxW, [int]$maxH, [string]$fmt) {
  $img = [System.Drawing.Image]::FromFile($src)
  try {
    $scale = [Math]::Min(1.0, [Math]::Min($maxW / $img.Width, $maxH / $img.Height))
    $w = [Math]::Max(1, [int][Math]::Round($img.Width * $scale)); $h = [Math]::Max(1, [int][Math]::Round($img.Height * $scale))
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = 'HighQualityBicubic'; $g.SmoothingMode = 'HighQuality'; $g.PixelOffsetMode = 'HighQuality'
    if ($fmt -eq 'jpg') { $g.Clear([System.Drawing.Color]::White) }
    $g.DrawImage($img, 0, 0, $w, $h); $g.Dispose()
    if ($fmt -eq 'jpg') {
      $p = New-Object System.Drawing.Imaging.EncoderParameters(1)
      $p.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]84)
      $bmp.Save($dest, $jpegCodec, $p)
    } else { $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png) }
    $bmp.Dispose()
    return @($w, $h)
  } finally { $img.Dispose() }
}

$artworks = [ordered]@{}   # media file -> artwork record
$symbols = @{}             # media file -> relative path
function Use-Artwork([string]$file, [string]$artist) {
  if (-not $artworks.Contains($file)) {
    $id = 'art' + ($artworks.Count + 1).ToString('00')
    $size = Save-Resized $file (Join-Path $artDir "$id.jpg") 720 520 'jpg'
    $artworks[$file] = [ordered]@{ id = $id; img = "assets/art/$id.jpg"; artist = $artist; w = $size[0]; h = $size[1] }
  } elseif ($artist -and -not $artworks[$file].artist) { $artworks[$file].artist = $artist }
  return $artworks[$file].id
}
function Use-Symbol([string]$file) {
  if (-not $symbols.ContainsKey($file)) {
    $name = 'set' + ($symbols.Count + 1).ToString('00') + '.png'
    Save-Resized $file (Join-Path $setDir $name) 96 96 'png' | Out-Null
    $symbols[$file] = "assets/sets/$name"
  }
  return $symbols[$file]
}

# ---------------------------------------------------------------- parse tabs
$LANG_COLS_MULTI = @{ 10 = 'DE'; 11 = 'FR'; 12 = 'IT'; 13 = 'PT'; 14 = 'ES'; 15 = 'LA'; 16 = 'KO'; 17 = 'ZS'; 18 = 'ZT'; 19 = 'ID'; 20 = 'TH' }
$cards = New-Object System.Collections.ArrayList
$ids = @{}

function Parse-Tab([string]$tabName, [string]$kind) {
  $path = $sheetFiles[$tabName]
  if (-not $path) { Write-Warning "Tab '$tabName' not found"; return }
  $rows = Read-Sheet $path
  $pics = Read-Pictures $path
  $rowNums = @($rows.Keys | Sort-Object)

  # Split into artwork blocks: each starts at a row whose column B says "Artwork"
  $blocks = @(); $cur = $null
  foreach ($r in $rowNums) {
    $b = Clean $rows[$r][1]
    if ($b -eq 'Artwork') { $cur = @{ start = $r; rows = @() }; $blocks += $cur; continue }
    if ($cur) { $cur.rows += $r }
  }
  for ($bi = 0; $bi -lt $blocks.Count; $bi++) {
    $blk = $blocks[$bi]
    $end = if ($bi + 1 -lt $blocks.Count) { $blocks[$bi + 1].start - 1 } else { 100000 }
    $artist = ''
    foreach ($r in $blk.rows) { $b = Clean $rows[$r][1]; if ($b) { $artist = $b } }
    $artPic = $pics | Where-Object { $_.col -le 4 -and $_.row -gt $blk.start -and $_.row -le $end } | Select-Object -First 1
    $artId = if ($artPic) { Use-Artwork $artPic.file $artist } else { '' }

    foreach ($r in $blk.rows) {
      $c = $rows[$r]
      $name = Clean $c[5]; $num = Clean-Number $c[6]
      if (-not $name -and -not $num) { continue }
      if ($kind -eq 'engjpn') {
        $setPair = Clean-Set $c[7]; $variant = Clean-Variant $c[8]; $setCode = ''
        $note = Clean $c[11]
        if ($c[9]) { $lang = 'EN'; $statusRaw = $c[9] }
        elseif ($c[10]) { $lang = 'JA'; $statusRaw = $c[10] }
        else { $lang = if (Has-NonLatin $name) { 'JA' } else { 'EN' }; $statusRaw = '' }
      } else {
        $setCode = Clean $c[7]; $setPair = Clean-Set $c[8]; $variant = Clean-Variant $c[9]; $note = ''
        $lang = ''; $statusRaw = ''
        foreach ($col in ($LANG_COLS_MULTI.Keys | Sort-Object)) { if ($c[$col]) { $lang = $LANG_COLS_MULTI[$col]; $statusRaw = $c[$col]; break } }
        if (-not $lang) { continue }
      }
      $fixKey = "$lang|$($setPair[0])|$num|$variant"
      if ($NUM_FIX.ContainsKey($fixKey)) { $num = $NUM_FIX[$fixKey] }
      $st = Parse-Status $statusRaw
      $symPic = $pics | Where-Object { $_.col -eq 7 -and $_.row -eq $r } | Select-Object -First 1
      $key = "$lang|$($setPair[0])|$num|$variant|$name".ToLower()
      $id = 'c' + (Get-Hash $key)
      if ($ids.ContainsKey($id)) { $ids[$id]++; $id = "$id-$($ids[$id])" } else { $ids[$id] = 1 }
      [void]$cards.Add([ordered]@{
        id = $id; name = $name; lang = $lang; set = $setPair[0]; native = $setPair[1]; code = $setCode
        num = $num; type = $variant; status = $st[0]; grade = $st[1]; note = $note
        artist = $artist; art = $artId; sym = $(if ($symPic) { Use-Symbol $symPic.file } else { '' })
        list = $kind; date = ''; price = ''; img = ''
      })
    }
  }
}

Write-Host 'Reading tabs...'
Parse-Tab 'ENGJPN' 'engjpn'
Parse-Tab 'MULTI-LANGUAGE TCG' 'multi'

# A row with a set code but no set name borrows the name from another row with the same code prefix
foreach ($c in $cards) {
  if (-not $c.set -and $c.code) {
    $prefix = ($c.code -split ' ')[0]
    $hit = $cards | Where-Object { $_.set -and $_.code -and (($_.code -split ' ')[0] -eq $prefix) } | Select-Object -First 1
    if ($hit) { $c.set = $hit.set }
  }
}

# Set symbols only exist on some rows: share them with every card from the same set
$symBySet = @{}
foreach ($c in $cards) { if ($c.sym -and -not $symBySet.ContainsKey($c.set)) { $symBySet[$c.set] = $c.sym } }
foreach ($c in $cards) { if (-not $c.sym -and $symBySet.ContainsKey($c.set)) { $c.sym = $symBySet[$c.set] } }

# Fill in artists on artworks that only had them on the other tab
foreach ($a in $artworks.Values) {
  if (-not $a.artist) { $hit = $cards | Where-Object { $_.art -eq $a.id -and $_.artist } | Select-Object -First 1; if ($hit) { $a.artist = $hit.artist } }
}

# ---------------------------------------------------------------- write data/cards.js
$seed = [ordered]@{
  generated = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss')
  source = "https://docs.google.com/spreadsheets/d/$SheetId"
  artworks = @($artworks.Values)
  cards = @($cards)
}
$json = $seed | ConvertTo-Json -Depth 6 -Compress
$js = "// Generated by tools/import-sheet.ps1 from the Scizor Google Sheet. Re-run that script to refresh it.`n" +
      "window.SCIZOR_SEED = $json;`n"
New-Item -ItemType Directory -Force -Path (Join-Path $root 'data') | Out-Null
[IO.File]::WriteAllText((Join-Path $root 'data\cards.js'), $js, $utf8)

Remove-Item -Recurse -Force $tmp
$names = @{ ob = 'obtained'; tr = 'in transit'; un = 'unobtained' }
$by = $cards | Group-Object { $_.status } | ForEach-Object { "$($_.Count) $($names[$_.Name])" }
Write-Host ("Done: {0} cards, {1} artworks, {2} set symbols ({3})" -f $cards.Count, $artworks.Count, $symbols.Count, ($by -join ', '))
