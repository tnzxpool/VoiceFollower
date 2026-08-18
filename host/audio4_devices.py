"""Inventario audio .4: uscita predefinita reale, tutti gli endpoint audio
(anche scollegati), dispositivi Bluetooth accoppiati e loro stato."""
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HOST, USER, KEY = "192.168.1.4", "sx", "H:/keys/tnzx_gpu_key"

PS = r'''
# uscita/ingresso predefiniti (id endpoint via WinRT)
try {
  $null = [Windows.Media.Devices.MediaDevice,Windows.Media.Devices,ContentType=WindowsRuntime]
  $rid = [Windows.Media.Devices.MediaDevice]::GetDefaultAudioRenderId([Windows.Media.Devices.AudioDeviceRole]::Default)
  $cid = [Windows.Media.Devices.MediaDevice]::GetDefaultAudioCaptureId([Windows.Media.Devices.AudioDeviceRole]::Default)
  Write-Output ("default render id: " + $rid)
  Write-Output ("default capture id: " + $cid)
} catch { Write-Output ("WinRT default id ERRORE: " + $_.Exception.Message) }

Write-Output "--- endpoint audio (tutti) ---"
Get-PnpDevice -Class AudioEndpoint -ErrorAction SilentlyContinue |
  Sort-Object Status |
  ForEach-Object { Write-Output ("  [" + $_.Status + "] " + $_.FriendlyName + "  {" + $_.InstanceId + "}") }

Write-Output "--- dispositivi Bluetooth ---"
Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue |
  ForEach-Object { Write-Output ("  [" + $_.Status + "] " + $_.FriendlyName) }

Write-Output "--- radio Bluetooth ---"
$r = Get-PnpDevice -ErrorAction SilentlyContinue | Where-Object { $_.Class -eq 'Bluetooth' -and $_.FriendlyName -match 'Radio|Adapter|Dongle' }
if (-not $r) { $r = Get-PnpDevice -FriendlyName '*bluetooth*' -ErrorAction SilentlyContinue | Select-Object -First 5 }
$r | ForEach-Object { Write-Output ("  [" + $_.Status + "] " + $_.FriendlyName) }

Write-Output "--- modulo AudioDeviceCmdlets ---"
if (Get-Module -ListAvailable AudioDeviceCmdlets) { Write-Output "  presente" } else { Write-Output "  assente" }
'''

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=15)
sftp = c.open_sftp(); home = sftp.normalize(".")
with sftp.open(home + "/ad.ps1", "w") as f: f.write(PS)
sftp.close()
_, o, e = c.exec_command('powershell -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\\ad.ps1"', timeout=90)
print(o.read().decode(errors="replace"))
err = e.read().decode(errors="replace").strip()
if err: print("STDERR:", err[:400])
c.exec_command('del "%USERPROFILE%\\ad.ps1"')
c.close()
