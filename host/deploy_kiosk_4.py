"""Deploy postazione kiosk sul PC 192.168.1.4 via SSH (paramiko).

Uso (dalla macchina .3):  python H:/VoiceFollower/host/deploy_kiosk_4.py
- carica KIOSK_4.bat sul Desktop di sx
- crea il collegamento di avvio automatico in shell:startup
- l'host dell'app viene scelto DAL PC .4: prima la VM vf-host (.90),
  altrimenti il master (.3). Il kiosk parte al prossimo login o con
  doppio click sul bat.
"""
import sys
import paramiko

HOST, USER, KEY = "192.168.1.4", "sx", "H:/keys/tnzx_gpu_key"
BAT_LOCAL = "H:/VoiceFollower/KIOSK_4.bat"
HOSTS = ["192.168.1.89", "192.168.1.3"]  # ordine di preferenza

PS1 = r'''
$ErrorActionPreference='Stop'
$hosts = @('__H1__','__H2__')
$app = $null
foreach ($h in $hosts) { try { $t = Test-NetConnection $h -Port 3000 -WarningAction SilentlyContinue; if ($t.TcpTestSucceeded) { $app = $h; break } } catch {} }
if (-not $app) { Write-Output ('ATTENZIONE: nessun host con porta 3000 aperta, uso ' + $hosts[0]); $app = $hosts[0] }
$origin = 'http://' + $app + ':3000'
$url = $origin + '/?vista=sorveglianza&kiosk=1'
$browser = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { Write-Output 'KO: nessun browser trovato'; exit 1 }
$lnk = [Environment]::GetFolderPath('Startup') + '\VoiceFollower-Kiosk.lnk'
$s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
$s.TargetPath = $browser
$s.Arguments = '--kiosk --autoplay-policy=no-user-gesture-required --use-fake-ui-for-media-stream --unsafely-treat-insecure-origin-as-secure=' + $origin + ' "' + $url + '"'
$s.Save()
Write-Output "OK: $lnk -> $browser"
Write-Output "URL: $url"
'''.replace("__H1__", HOSTS[0]).replace("__H2__", HOSTS[1])


def main() -> int:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, key_filename=KEY, timeout=10)

    sftp = c.open_sftp()
    home = sftp.normalize(".")
    sftp.put(BAT_LOCAL, home + "/Desktop/KIOSK_4.bat")
    with sftp.open(home + "/kiosk_setup.ps1", "w") as f:
        f.write(PS1)
    sftp.close()

    _, o, e = c.exec_command(
        'powershell -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\\kiosk_setup.ps1"',
        timeout=60,
    )
    out, err = o.read().decode(errors="replace"), e.read().decode(errors="replace")
    print(out)
    if err.strip():
        print("STDERR:", err[:500])
    c.close()
    return 0 if "OK:" in out else 1


if __name__ == "__main__":
    sys.exit(main())
