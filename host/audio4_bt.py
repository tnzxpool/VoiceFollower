"""Connette la cassa BT SOLSKYDD 19 su .4 e la mette come uscita predefinita.
1. toggla il dispositivo BT per forzare la riconnessione A2DP;
2. installa AudioDeviceCmdlets se manca; 3. default -> SOLSKYDD, volume 80%;
4. frase di prova con SAPI per conferma a orecchio."""
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HOST, USER, KEY = "192.168.1.4", "sx", "H:/keys/tnzx_gpu_key"

PS = r'''
$name = 'SOLSKYDD 19'

# 1. forza la riconnessione: toggle del dispositivo bluetooth
$bt = Get-PnpDevice -Class Bluetooth -FriendlyName $name -ErrorAction SilentlyContinue | Select-Object -First 1
if ($bt) {
  try {
    Disable-PnpDevice -InstanceId $bt.InstanceId -Confirm:$false -ErrorAction Stop
    Start-Sleep 2
    Enable-PnpDevice -InstanceId $bt.InstanceId -Confirm:$false -ErrorAction Stop
    Write-Output "toggle BT: fatto"
  } catch { Write-Output ("toggle BT: ERRORE - " + $_.Exception.Message) }
} else { Write-Output "dispositivo BT non trovato" }
Start-Sleep 8

# stato endpoint dopo il toggle
$ep = Get-PnpDevice -Class AudioEndpoint -ErrorAction SilentlyContinue | Where-Object { $_.FriendlyName -like "*SOLSKYDD*" }
$ep | ForEach-Object { Write-Output ("endpoint: [" + $_.Status + "] " + $_.FriendlyName) }

# 2. modulo per cambiare l'uscita predefinita
if (-not (Get-Module -ListAvailable AudioDeviceCmdlets)) {
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -Scope CurrentUser | Out-Null
    Install-Module AudioDeviceCmdlets -Force -Scope CurrentUser -AllowClobber
    Write-Output "AudioDeviceCmdlets installato"
  } catch { Write-Output ("installazione modulo ERRORE: " + $_.Exception.Message) }
}

# 3. default su SOLSKYDD
try {
  Import-Module AudioDeviceCmdlets -ErrorAction Stop
  $dev = Get-AudioDevice -List | Where-Object { $_.Type -eq 'Playback' -and $_.Name -like "*SOLSKYDD*" } | Select-Object -First 1
  if ($dev) {
    Set-AudioDevice -ID $dev.ID | Out-Null
    Set-AudioDevice -PlaybackVolume 80
    Write-Output ("default impostato: " + $dev.Name)
  } else {
    Write-Output "SOLSKYDD non in elenco riproduzione (non connessa): la cassa e' accesa e vicina?"
    Get-AudioDevice -List | Where-Object Type -eq 'Playback' | ForEach-Object { Write-Output ("  disponibile: " + $_.Name + ($(if ($_.Default) {' [DEFAULT]'}))) }
  }
} catch { Write-Output ("Set-AudioDevice ERRORE: " + $_.Exception.Message) }

# 4. prova a voce
try {
  (New-Object -ComObject SAPI.SpVoice).Speak("Prova audio dalla cassa bluetooth. Mi senti?") | Out-Null
  Write-Output "frase di prova pronunciata"
} catch { Write-Output ("SAPI ERRORE: " + $_.Exception.Message) }
'''

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=15)
sftp = c.open_sftp(); home = sftp.normalize(".")
with sftp.open(home + "/abt.ps1", "w") as f: f.write(PS)
sftp.close()
_, o, e = c.exec_command('powershell -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\\abt.ps1"', timeout=200)
print(o.read().decode(errors="replace"))
err = e.read().decode(errors="replace").strip()
if err: print("STDERR:", err[:400])
c.exec_command('del "%USERPROFILE%\\abt.ps1"')
c.close()
