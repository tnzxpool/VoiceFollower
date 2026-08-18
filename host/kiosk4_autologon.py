import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HOST, USER, KEY = "192.168.1.4", "sx", "H:/keys/tnzx_gpu_key"
PS = r'''
$wl = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' -ErrorAction SilentlyContinue
Write-Output ("AutoAdminLogon: " + $wl.AutoAdminLogon)
Write-Output ("DefaultUserName: " + $wl.DefaultUserName)
Write-Output ("DefaultDomainName: " + $wl.DefaultDomainName)
Write-Output ("DefaultPassword presente: " + [bool]$wl.DefaultPassword)
Write-Output ("utente console ora: " + (Get-CimInstance Win32_ComputerSystem).UserName)
$p = Get-Process msedge -ErrorAction SilentlyContinue
Write-Output ("Edge: " + $(if ($p) { "attivo" } else { "non attivo" }))
'''
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=15)
sftp = c.open_sftp(); home = sftp.normalize(".")
with sftp.open(home + "/al.ps1", "w") as f: f.write(PS)
sftp.close()
_, o, e = c.exec_command('powershell -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\\al.ps1"', timeout=60)
print(o.read().decode(errors="replace"))
err = e.read().decode(errors="replace").strip()
if err: print("STDERR:", err[:300])
c.exec_command('del "%USERPROFILE%\\al.ps1"')
c.close()
