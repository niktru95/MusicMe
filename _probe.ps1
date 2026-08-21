$lines = [System.IO.File]::ReadAllLines('c:/Users/Mupok/MusicMe/MusicMe/js/data/t01-notes.js', [System.Text.Encoding]::UTF8)
foreach ($idx in array(5, 8, 9)) {
  $line = $lines[$idx]
  $m = [regex]::Match($line, 'знак[^\\]*(\\\\n|\\n)')
  $snippet = $line
  $pos = $snippet.IndexOf('знаков')
  $seg = $pos >= 0 ? $snippet.Substring($pos) : $snippet
  $vis = ''
  foreach ($ch in $seg.ToCharArray()) {
    if ([string]$ch -eq '\\') { $vis += '[BS]' } else { $vis += $ch }
  }
  Write-Output ('L' + ($idx+1) + ': ' + $vis)
}