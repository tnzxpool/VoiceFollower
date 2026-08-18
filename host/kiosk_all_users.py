"""Kiosk per TUTTI gli account di .4: bat su Public Desktop, collegamento nello Startup comune.
Attende che .4 torni su dopo il riavvio, poi sistema e verifica.
"""
import paramiko, socket, sys, time
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST, USER, KEY = "192.168.1.4", "sx", "H:/keys/tnzx_gpu_key"

PS = r'''
$hosts = @('192.168.1.89','192.168.1.3')
$app = $null
foreach ($h in $hosts) { try { $t = Test-NetConnection $h -Port 3000 -WarningAction SilentlyContinue; if ($t.TcpTestSucceeded) { $app = $h; break } } catch {} }
if (-not $app) { $app = $hosts[0] }
$origin = 'http://' + $app + ':3000'
$url = $origin + '/?vista=sorveglianza&kiosk=1'
$browser = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

# 1. bat sul Desktop pubblico (visibile a ogni account)
try {
  Copy-Item "$env:USERPROFILE\Desktop\KIOSK_4.bat" 'C:\Users\Public\Desktop\KIOSK_4.bat' -Force
  Write-Output 'bat su Public Desktop: OK'
} catch { Write-Output ("bat su Public Desktop: NEGATO - " + $_.Exception.Message) }

# 2. collegamento nello Startup comune (parte per ogni account)
$common = 'C:\ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp\VoiceFollower-Kiosk.lnk'
try {
  $s = (New-Object -ComObject WScript.Shell).CreateShortcut($common)
  $s.TargetPath = $browser
  $s.Arguments = '--kiosk --autoplay-policy=no-user-gesture-required --use-fake-ui-for-media-stream --unsafely-treat-insecure-origin-as-secure=' + $origin + ' "' + $url + '"'
  $s.Save()
  Write-Output ('startup comune: OK -> ' + $common)
} catch { Write-Output ("startup comune: NEGATO - " + $_.Exception.Message) }

# 3. fallback: copia anche nei profili utente reali (nx ecc.)
foreach ($u in @('nx','nx.DESKTOP-2JONOO6')) {
  $d = "C:\Users\$u\Desktop"
  if (Test-Path $d) {
    try { Copy-Item "$env:USERPROFILE\Desktop\KIOSK_4.bat" (Join-Path $d 'KIOSK_4.bat') -Force; Write-Output ("bat su ${d}: OK") }
    catch { Write-Output ("bat su ${d}: NEGATO") }
  }
}
Write-Output ("host scelto ora: " + $url)
'''

# attesa che .4 torni raggiungibile
print("attendo che .4 torni su...")
deadline = time.time() + 300
up = False
while time.time() < deadline:
    try:
        s = socket.create_connection(("192.168.1.4", 22), timeout=3); s.close(); up = True; break
    except OSError:
        time.sleep(10)
if not up:
    print(".4 non e' tornato raggiungibile entro 5 minuti"); sys.exit(1)
time.sleep(10)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=15)
sftp = c.open_sftp()
home = sftp.normalize(".")
with sftp.open(home + "/kiosk_all_users.ps1", "w") as f:
    f.write(PS)
sftp.close()
_, o, e = c.exec_command('powershell -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\\kiosk_all_users.ps1"', timeout=90)
print(o.read().decode(errors="replace"))
err = e.read().decode(errors="replace").strip()
if err: print("STDERR:", err[:400])
c.close()
