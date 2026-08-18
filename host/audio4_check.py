"""Controllo audio su .4: volume/mute casse, volume/mute microfono, consenso
microfono per app desktop, browser kiosk in esecuzione. Se le casse sono mute
o basse, le sistema (80%). Idem per il microfono."""
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST, USER, KEY = "192.168.1.4", "sx", "H:/keys/tnzx_gpu_key"

PS = r'''
$cs = @"
using System;
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int RegisterControlChangeNotify(IntPtr pNotify);
  int UnregisterControlChangeNotify(IntPtr pNotify);
  int GetChannelCount(out uint channelCount);
  int SetMasterVolumeLevel(float level, ref Guid eventContext);
  int SetMasterVolumeLevelScalar(float level, ref Guid eventContext);
  int GetMasterVolumeLevel(out float level);
  int GetMasterVolumeLevelScalar(out float level);
  int SetChannelVolumeLevel(uint channelNumber, float level, ref Guid eventContext);
  int SetChannelVolumeLevelScalar(uint channelNumber, float level, ref Guid eventContext);
  int GetChannelVolumeLevel(uint channelNumber, out float level);
  int GetChannelVolumeLevelScalar(uint channelNumber, out float level);
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool isMuted, ref Guid eventContext);
  int GetMute(out bool isMuted);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
  int Activate(ref Guid id, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object aev);
}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
  int NotImpl1();
  int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
}
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
public class Audio {
  static IAudioEndpointVolume Vol(int flow) {
    var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
    IMMDevice dev = null;
    Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(flow, 1, out dev));
    Guid epvid = typeof(IAudioEndpointVolume).GUID;
    object o;
    Marshal.ThrowExceptionForHR(dev.Activate(ref epvid, 23, IntPtr.Zero, out o));
    return (IAudioEndpointVolume)o;
  }
  public static float GetVol(int flow) { float v; Marshal.ThrowExceptionForHR(Vol(flow).GetMasterVolumeLevelScalar(out v)); return v; }
  public static void SetVol(int flow, float v) { Guid g = Guid.Empty; Marshal.ThrowExceptionForHR(Vol(flow).SetMasterVolumeLevelScalar(v, ref g)); }
  public static bool GetMute(int flow) { bool m; Marshal.ThrowExceptionForHR(Vol(flow).GetMute(out m)); return m; }
  public static void SetMute(int flow, bool m) { Guid g = Guid.Empty; Marshal.ThrowExceptionForHR(Vol(flow).SetMute(m, ref g)); }
}
"@
try { Add-Type -TypeDefinition $cs -ErrorAction Stop } catch {}

# CASSE (flow 0 = render)
try {
  $v = [Audio]::GetVol(0); $m = [Audio]::GetMute(0)
  Write-Output ("CASSE: volume {0}% mute={1}" -f [int]($v*100), $m)
  if ($m) { [Audio]::SetMute(0, $false); Write-Output "CASSE: tolto il mute" }
  if ($v -lt 0.5) { [Audio]::SetVol(0, 0.8); Write-Output "CASSE: volume alzato a 80%" }
} catch { Write-Output ("CASSE: ERRORE - " + $_.Exception.Message) }

# MICROFONO (flow 1 = capture)
try {
  $v = [Audio]::GetVol(1); $m = [Audio]::GetMute(1)
  Write-Output ("MIC: volume {0}% mute={1}" -f [int]($v*100), $m)
  if ($m) { [Audio]::SetMute(1, $false); Write-Output "MIC: tolto il mute" }
  if ($v -lt 0.5) { [Audio]::SetVol(1, 0.8); Write-Output "MIC: volume alzato a 80%" }
} catch { Write-Output ("MIC: ERRORE (forse nessun microfono collegato) - " + $_.Exception.Message) }

# dispositivi presenti
Write-Output "--- dispositivi audio ---"
Get-CimInstance Win32_SoundDevice | ForEach-Object { Write-Output ("  " + $_.Name + " [" + $_.Status + "]") }

# consenso microfono (privacy Windows) per app desktop
Write-Output "--- consenso microfono ---"
foreach ($k in @('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone',
                 'HKCU:\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone',
                 'HKCU:\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone\NonPackaged')) {
  try { $val = (Get-ItemProperty $k -ErrorAction Stop).Value; Write-Output ("  " + $k.Split('\')[0] + " " + $k.Split('\')[-1] + ": " + $val) } catch {}
}

# browser kiosk in esecuzione?
Write-Output "--- browser attivi ---"
$b = Get-Process msedge,chrome -ErrorAction SilentlyContinue | Group-Object Name | ForEach-Object { "  $($_.Name) x$($_.Count)" }
if ($b) { $b } else { Write-Output "  NESSUN browser attivo (il kiosk non sta girando!)" }

# chi e' loggato alla console
Write-Output "--- utente console ---"
try { $u = (Get-CimInstance Win32_ComputerSystem).UserName; if ($u) { Write-Output ("  " + $u) } else { Write-Output "  nessuno loggato" } } catch {}
'''

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=15)
sftp = c.open_sftp()
home = sftp.normalize(".")
with sftp.open(home + "/audio4_check.ps1", "w") as f:
    f.write(PS)
sftp.close()
_, o, e = c.exec_command('powershell -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\\audio4_check.ps1"', timeout=90)
print(o.read().decode(errors="replace"))
err = e.read().decode(errors="replace").strip()
if err: print("STDERR:", err[:500])
c.exec_command('del "%USERPROFILE%\\audio4_check.ps1"')
c.close()
