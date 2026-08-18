"""Aggiorna il collegamento kiosk di .4 (--no-first-run) e riavvia la macchina
perche' Edge riparta con la pagina nuova. Poi verifica che il kiosk sia su."""
import paramiko, socket, sys, time
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HOST, USER, KEY = "192.168.1.4", "sx", "H:/keys/tnzx_gpu_key"

PS = r'''
$lnk = 'C:\ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp\VoiceFollower-Kiosk.lnk'
$s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
if ($s.Arguments -notmatch 'no-first-run') {
  $s.Arguments = '--no-first-run ' + $s.Arguments
  $s.Save()
  Write-Output "lnk aggiornato con --no-first-run"
} else { Write-Output "lnk gia' a posto" }
Write-Output ("args: " + $s.Arguments)
'''

VERIFY = r'''
$p = Get-Process msedge -ErrorAction SilentlyContinue
if ($p) { Write-Output ("Edge attivo (" + ($p | Measure-Object).Count + " processi)") } else { Write-Output "Edge NON attivo" }
$cmd = (Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -match 'kiosk' } | Select-Object -First 1).CommandLine
if ($cmd) { Write-Output ("riga di comando kiosk: " + $cmd.Substring(0, [Math]::Min(260, $cmd.Length))) } else { Write-Output "nessun processo con --kiosk" }
'''

def run(c, script, name, timeout=60):
    sftp = c.open_sftp(); home = sftp.normalize(".")
    with sftp.open(home + "/" + name, "w") as f: f.write(script)
    sftp.close()
    _, o, e = c.exec_command(f'powershell -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\\{name}"', timeout=timeout)
    print(o.read().decode(errors="replace"))
    err = e.read().decode(errors="replace").strip()
    if err: print("STDERR:", err[:300])
    c.exec_command(f'del "%USERPROFILE%\\{name}"')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=15)
run(c, PS, "kr.ps1")
print("riavvio .4...")
c.exec_command("shutdown /r /t 3")
c.close()

time.sleep(30)
deadline = time.time() + 300
while time.time() < deadline:
    try:
        s = socket.create_connection((HOST, 22), timeout=3); s.close(); break
    except OSError:
        time.sleep(10)
else:
    print(".4 non tornato su in 5 minuti"); sys.exit(1)
print(".4 su, attendo logon+kiosk...")
time.sleep(45)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=15)
run(c, VERIFY, "kv.ps1")
c.close()
