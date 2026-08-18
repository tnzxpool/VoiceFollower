@echo off
REM ============================================================
REM KIOSK_4.bat - trasforma QUESTO PC (192.168.1.4) in postazione
REM kiosk di sorveglianza VoiceFollower. Doppio click e basta.
REM - sceglie da solo l'host attivo: prima la VM vf-host (.90),
REM   altrimenti il PC master (.3)
REM - crea il collegamento di avvio automatico in shell:startup
REM - avvia subito il kiosk per prova
REM ============================================================
setlocal

REM >>> host in ordine di preferenza <<<
set "HOST1=192.168.1.89"
set "HOST2=192.168.1.3"

set "PS1=%TEMP%\vf_kiosk_setup.ps1"
> "%PS1%" echo $ErrorActionPreference='Stop'
>> "%PS1%" echo $hosts = @('%HOST1%','%HOST2%')
>> "%PS1%" echo $app = $null
>> "%PS1%" echo foreach ($h in $hosts) { try { $t = Test-NetConnection $h -Port 3000 -WarningAction SilentlyContinue; if ($t.TcpTestSucceeded) { $app = $h; break } } catch {} }
>> "%PS1%" echo if (-not $app) { Write-Output ('ATTENZIONE: nessun host con la porta 3000 aperta. Uso ' + $hosts[0] + ': il kiosk mostrera un errore finche la VM vf-host non sara accesa.'); $app = $hosts[0] }
>> "%PS1%" echo $origin = 'http://' + $app + ':3000'
>> "%PS1%" echo $url = $origin + '/?vista=sorveglianza^&kiosk=1'
>> "%PS1%" echo $browser = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe") ^| Where-Object { Test-Path $_ } ^| Select-Object -First 1
>> "%PS1%" echo if (-not $browser) { Write-Output 'ERRORE: Chrome/Edge non trovati. Installa Chrome e rilancia.'; exit 1 }
>> "%PS1%" echo $args = '--kiosk --autoplay-policy=no-user-gesture-required --use-fake-ui-for-media-stream --unsafely-treat-insecure-origin-as-secure=' + $origin + ' "' + $url + '"'
>> "%PS1%" echo $lnk = [Environment]::GetFolderPath('Startup') + '\VoiceFollower-Kiosk.lnk'
>> "%PS1%" echo $s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
>> "%PS1%" echo $s.TargetPath = $browser
>> "%PS1%" echo $s.Arguments = $args
>> "%PS1%" echo $s.Save()
>> "%PS1%" echo Write-Output ('OK collegamento avvio automatico: ' + $lnk)
>> "%PS1%" echo Write-Output ('Host scelto: ' + $origin)
>> "%PS1%" echo Write-Output 'Avvio kiosk di prova... (per uscire: ALT+F4)'
>> "%PS1%" echo Start-Process $browser $args

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
if errorlevel 1 echo Qualcosa e' andato storto: leggi il messaggio qui sopra.
pause
endlocal
