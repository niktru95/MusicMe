$ErrorActionPreference = 'Stop'
$root = 'c:/Users/Mupok/MusicMe/MusicMe'
$appPath = Join-Path $root 'js/app.js'
$outPath = Join-Path $root '_scratch_compile.html'
$js = [System.IO.File]::ReadAllText($appPath, [System.Text.Encoding]::UTF8)

# Экранирование для встраивания в JS-строку: backslash, затем кавычки, затем переводы строк
$esc = $js.Replace('\', '\\').Replace('"', '\"')
$esc = $esc.Replace([string][char]10, '\n').Replace([string][char]13, '')

$body = @"
<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"></head><body>
<script>
window.__e = [];
window.onerror = function (m, s, l) { window.__e.push(String(m) + ' | line ' + l); return false; };
var code = "$esc";
var d = document.createElement('div');
d.id = 'comp';
d.style.cssText = 'white-space:pre;font:11px monospace';
try {
  new Function(code);
  d.textContent = 'COMPILE-OK len=' + code.length + ' errs=' + window.__e.length;
} catch (e) {
  d.textContent = 'COMPILE-ERR: ' + (e && e.message ? e.message : String(e));
}
document.body.appendChild(d);
</script>
</body></html>
"@

[System.IO.File]::WriteAllText($outPath, $body, (New-Object System.Text.UTF8Encoding($false)))
Write-Output 'written'