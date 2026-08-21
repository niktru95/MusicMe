$path = 'c:/Users/Mupok/MusicMe/MusicMe/js/data/t01-notes.js'
$s = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$s = $s.Replace('\\n', '\n')
[System.IO.File]::WriteAllText($path, $s, (New-Object System.Text.UTF8Encoding($false)))
Write-Output 'fixed'