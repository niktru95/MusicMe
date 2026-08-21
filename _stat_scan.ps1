$files = @('t01-notes.js','t02-intervals.js','t03-major.js','t04-minor.js','t05-triads.js','t06-sevenths.js','t07-chords.js','t08-pentatonic.js','t09-circle.js')
$out = @()
foreach ($fn in $files) {
  $p = 'c:/Users/Mupok/MusicMe/MusicMe/js/data/' + $fn
  $l = [System.IO.File]::ReadAllLines($p, [System.Text.Encoding]::UTF8)
  $out += ('==== ' + $fn + ' lines=' + $l.Count + ' ====')
  for ($i=0; $i -lt $l.Count; $i++) {
    $line = $l[$i]
    if ($line.Trim() -eq '') { continue }
    $isTheoryHeader = $line -match "h:'|h: '|'Слушайте|'Тональности|'Вид минора|'На грифе|'Обращения|'Интервалы внутри|'Якорные|'Названия нот|'Большие и малые"
    $isArrClose = $line -match '^\s*\],'
    if ($isTheoryHeader -or $isArrClose -or $line -match 'theory:') {
      $out += ((($i+1).ToString()) + ': ' + $line)
    }
  }
}
Set-Content -Encoding utf8 -Path 'c:/Users/Mupok/MusicMe/MusicMe/_tstatus.txt' -Value ($out -join "`r`n")