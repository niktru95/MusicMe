$ErrorActionPreference = 'Stop'
$appPath = 'c:/Users/Mupok/MusicMe/MusicMe/js/app.js'
$lines = [System.IO.File]::ReadAllLines($appPath, [System.Text.Encoding]::UTF8)
$bal = 0
$out = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
  $line = $lines[$i]
  $opens = ([regex]::Matches($line, '\(')).Count
  $closes = ([regex]::Matches($line, '\)')).Count
  $bal += $opens - $closes
  if ($bal -lt 0) {
    $out += ('NEGATIVE line ' + ($i + 1) + ' bal=' + $bal + ' :: ' + $line.Trim())
  }
}
$out += ('FINAL balance=' + $bal + ' total lines=' + $lines.Count)
Set-Content -Encoding utf8 -Path 'c:/Users/Mupok/MusicMe/MusicMe/_scan_balance.txt' -Value ($out -join "`r`n")
Write-Output 'done'