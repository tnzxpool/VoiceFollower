"""Passa il kiosk di .4 a Edge (voci neurali italiane) e lo riavvia pulito.
1. chiude Chrome/Edge; 2. rifa' i collegamenti Startup (comune + utente) con Edge;
3. controlla auto-logon; 4. riavvia .4; 5. attende che torni su e verifica il browser."""
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

# Edge PRIMA di Chrome (voci "Online Natural" italiane)
$browser = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
Write-Output ("browser scelto: " + $browser)
Write-Output ("url: " + $url)

$args = '--kiosk --autoplay-policy=no-user-gesture-required --use-fake-ui-for-media-stream --unsafely-treat-insecure-origin-as-secure=' + $origin + ' "' + $url + '"'

# chiudi i browser attivi (pagina vecchia di giorni)
Get-Process msedge,chrome -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Output "browser chiusi"

# rifai i collegamenti: Startup comune + Startup utente
$targets = @(
  'C:\ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp\VoiceFollower-Kiosk.lnk',
  ([Environment]::GetFolderPath('Startup') + '\VoiceFollower-Kiosk.lnk')
)
$sh = New-Object -ComObject WScript.Shell
foreach ($lnk in $targets) {
  try {
    if (Test-Path $lnk) { Remove-Item $lnk -Force }
  } catch {}
}
# uno solo basta (comune): evita il doppio kiosk
try {
  $s = $sh.CreateShortcut($targets[0])
  $s.TargetPath = $browser
  $s.Arguments = $args
  $s.Save()
  Write-Output ("collegamento rifatto: " + $targets[0])
} catch {
  # senza diritti sul comune, ripiega sull'utente
  $s = $sh.CreateShortcut($targets[1])
  $s.TargetPath = $browser
  $s.Arguments = $args
  $s.Save()
  Write-Output ("collegamento rifatto (utente): " + $targets[1])
}

# auto-logon presente? (serve perche' il kiosk riparta da solo dopo il riavvio)
$wl = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' -ErrorAction SilentlyContinue
Write-Output ("auto-logon: AutoAdminLogon=" + $wl.AutoAdminLogon + " DefaultUserName=" + $wl.DefaultUserName)
'''

VERIFY = r'''
Start-Sleep 5
$p = Get-Process msedge,chrome -ErrorAction SilentlyContinue | Group-Object Name | ForEach-Object { "$($_.Name) x$($_.Count)" }
if ($p) { Write-Output ("browser attivo: " + ($p -join ', ')) } else { Write-Output "NESSUN browser attivo" }
$u = (Get-CimInstance Win32_ComputerSystem).UserName
Write-Output ("utente console: " + $u)
'''

def run(c, script, name, timeout=90):
    sftp = c.open_sftp()
    home = sftp.normalize(".")
    with sftp.open(home + "/" + name, "w") as f:
        f.write(script)
    sftp.close()
    _, o, e = c.exec_command(f'powershell -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\\{name}"', timeout=timeout)
    print(o.read().decode(errors="replace"))
    err = e.read().decode(errors="replace").strip()
    if err: print("STDERR:", err[:400])
    c.exec_command(f'del "%USERPROFILE%\\{name}"')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=15)
run(c, PS, "kiosk4_edge.ps1")
print("riavvio .4...")
c.exec_command("shutdown /r /t 5")
c.close()

# attesa ritorno
time.sleep(30)
deadline = time.time() + 300
up = False
while time.time() < deadline:
    try:
        s = socket.create_connection((HOST, 22), timeout=3); s.close(); up = True; break
    except OSError:
        time.sleep(10)
if not up:
    print(".4 non e' tornato su entro 5 minuti"); sys.exit(1)
print(".4 tornato su, attendo il logon e il kiosk...")
time.sleep(40)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=15)
run(c, VERIFY, "kiosk4_verify.ps1")
c.close()
