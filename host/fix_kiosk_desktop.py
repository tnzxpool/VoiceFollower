"""Sistema il bat sul Desktop VERO di .4 (gestisce redirezione OneDrive) e verifica."""
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST, USER, KEY = "192.168.1.4", "sx", "H:/keys/tnzx_gpu_key"

PS = r'''
$desk = [Environment]::GetFolderPath('Desktop')
Write-Output ("Desktop vero: " + $desk)
$src = "$env:USERPROFILE\Desktop\KIOSK_4.bat"
Write-Output ("In USERPROFILE\Desktop esiste: " + (Test-Path $src))
if ((Test-Path $src) -and ($desk -ne "$env:USERPROFILE\Desktop")) {
  Copy-Item $src (Join-Path $desk 'KIOSK_4.bat') -Force
  Write-Output 'copiato sul Desktop vero'
}
Write-Output ("Sul Desktop vero ora: " + (Test-Path (Join-Path $desk 'KIOSK_4.bat')))
$lnk = [Environment]::GetFolderPath('Startup') + '\VoiceFollower-Kiosk.lnk'
Write-Output ("Avvio automatico presente: " + (Test-Path $lnk))
'''

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=10)

sftp = c.open_sftp()
home = sftp.normalize(".")
sftp.put("H:/VoiceFollower/KIOSK_4.bat", home + "/Desktop/KIOSK_4.bat")  # rinfresco anche la copia
with sftp.open(home + "/fix_desktop.ps1", "w") as f:
    f.write(PS)
sftp.close()

_, o, e = c.exec_command('powershell -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\\fix_desktop.ps1"', timeout=60)
print(o.read().decode(errors="replace"))
err = e.read().decode(errors="replace").strip()
if err: print("STDERR:", err[:400])
c.close()
