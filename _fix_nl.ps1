$files = Get-ChildItem -Path 'c:/Users/Mupok/MusicMe/MusicMe/js/data' -Filter 't0*.js'
foreach ($f in $files) {
  $text = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
  if ($text.Contains('{NL}')) {
    $text = $text.Replace('{NL}', '\n')
    [System.IO.File]::WriteAllText($f.FullName, $text, (New-Object System.Text.UTF8Encoding($false)))
    Write-Output ('FIXED ' + $f.Name)
  }
}