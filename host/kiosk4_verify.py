import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HOST, USER, KEY = "192.168.1.4", "sx", "H:/keys/tnzx_gpu_key"
PS = r'''
$os = Get-CimInstance Win32_OperatingSystem
Write-Output ("acceso da: " + [int]((Get-Date) - $os.LastBootUpTime).TotalMinutes + " minuti")
$p = Get-Process msedge,chrome -ErrorAction SilentlyContinue | Group-Object Name | ForEach-Object { "$($_.Name) x$($_.Count)" }
if ($p) { Write-Output ("browser attivo: " + ($p -join ', ')) } else { Write-Output "NESSUN browser attivo" }
$lnk = 'C:\ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp\VoiceFollower-Kiosk.lnk'
if (Test-Path $lnk) {
  $s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
  Write-Output ("lnk comune -> " + $s.TargetPath)
} else { Write-Output "lnk comune ASSENTE" }
$ulnk = [Environment]::GetFolderPath('Startup') + '\VoiceFollower-Kiosk.lnk'
if (Test-Path $ulnk) {
  $s2 = (New-Object -ComObject WScript.Shell).CreateShortcut($ulnk)
  Write-Output ("lnk utente -> " + $s2.TargetPath)
} else { Write-Output "lnk utente assente" }
Write-Output ("utente console: " + (Get-CimInstance Win32_ComputerSystem).UserName)
'''
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=15)
sftp = c.open_sftp(); home = sftp.normalize(".")
with sftp.open(home + "/kv.ps1", "w") as f: f.write(PS)
sftp.close()
_, o, e = c.exec_command('powershell -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\\kv.ps1"', timeout=60)
print(o.read().decode(errors="replace"))
err = e.read().decode(errors="replace").strip()
if err: print("STDERR:", err[:300])
c.exec_command('del "%USERPROFILE%\\kv.ps1"')
c.close()
