"""Forza la connessione A2DP alla cassa SOLSKYDD 19 via BluetoothSetServiceState,
poi la mette come uscita predefinita a volume 80%."""
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HOST, USER, KEY = "192.168.1.4", "sx", "H:/keys/tnzx_gpu_key"

PS = r'''
$cs = @"
using System;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential)]
public struct SYSTEMTIME { public ushort wYear, wMonth, wDayOfWeek, wDay, wHour, wMinute, wSecond, wMilliseconds; }

[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
public struct BLUETOOTH_DEVICE_INFO {
    public uint dwSize;
    public ulong Address;
    public uint ulClassofDevice;
    [MarshalAs(UnmanagedType.Bool)] public bool fConnected;
    [MarshalAs(UnmanagedType.Bool)] public bool fRemembered;
    [MarshalAs(UnmanagedType.Bool)] public bool fAuthenticated;
    public SYSTEMTIME stLastSeen;
    public SYSTEMTIME stLastUsed;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 248)]
    public string szName;
}

[StructLayout(LayoutKind.Sequential)]
public struct BLUETOOTH_DEVICE_SEARCH_PARAMS {
    public uint dwSize;
    [MarshalAs(UnmanagedType.Bool)] public bool fReturnAuthenticated;
    [MarshalAs(UnmanagedType.Bool)] public bool fReturnRemembered;
    [MarshalAs(UnmanagedType.Bool)] public bool fReturnUnknown;
    [MarshalAs(UnmanagedType.Bool)] public bool fReturnConnected;
    [MarshalAs(UnmanagedType.Bool)] public bool fIssueInquiry;
    public byte cTimeoutMultiplier;
    public IntPtr hRadio;
}

public class BT {
    [DllImport("bthprops.cpl", CharSet=CharSet.Unicode)]
    public static extern IntPtr BluetoothFindFirstDevice(ref BLUETOOTH_DEVICE_SEARCH_PARAMS sp, ref BLUETOOTH_DEVICE_INFO di);
    [DllImport("bthprops.cpl", CharSet=CharSet.Unicode)]
    public static extern bool BluetoothFindNextDevice(IntPtr h, ref BLUETOOTH_DEVICE_INFO di);
    [DllImport("bthprops.cpl")]
    public static extern bool BluetoothFindDeviceClose(IntPtr h);
    [DllImport("bthprops.cpl", CharSet=CharSet.Unicode)]
    public static extern int BluetoothSetServiceState(IntPtr hRadio, ref BLUETOOTH_DEVICE_INFO di, ref Guid guid, int state);

    public static Guid AudioSink = new Guid("0000110B-0000-1000-8000-00805F9B34FB");

    public static string Reconnect(string name) {
        var sp = new BLUETOOTH_DEVICE_SEARCH_PARAMS();
        sp.dwSize = (uint)Marshal.SizeOf(typeof(BLUETOOTH_DEVICE_SEARCH_PARAMS));
        sp.fReturnAuthenticated = true; sp.fReturnRemembered = true; sp.fReturnConnected = true;
        sp.fReturnUnknown = false; sp.fIssueInquiry = false; sp.cTimeoutMultiplier = 2; sp.hRadio = IntPtr.Zero;
        var di = new BLUETOOTH_DEVICE_INFO();
        di.dwSize = (uint)Marshal.SizeOf(typeof(BLUETOOTH_DEVICE_INFO));
        IntPtr h = BluetoothFindFirstDevice(ref sp, ref di);
        if (h == IntPtr.Zero) return "nessun dispositivo BT accoppiato trovato";
        string result = "non trovato: " + name;
        do {
            if (di.szName == name) {
                int r1 = BluetoothSetServiceState(IntPtr.Zero, ref di, ref AudioSink, 0);
                System.Threading.Thread.Sleep(2000);
                int r2 = BluetoothSetServiceState(IntPtr.Zero, ref di, ref AudioSink, 1);
                result = "trovato (era connesso=" + di.fConnected + "), disable rc=" + r1 + ", enable rc=" + r2;
                break;
            }
        } while (BluetoothFindNextDevice(h, ref di));
        BluetoothFindDeviceClose(h);
        return result;
    }
}
"@
try { Add-Type -TypeDefinition $cs -ErrorAction Stop } catch { Write-Output ("Add-Type ERRORE: " + $_.Exception.Message) }

Write-Output ([BT]::Reconnect('SOLSKYDD 19'))
Write-Output "attendo che l'endpoint audio compaia..."
$ok = $false
for ($i = 0; $i -lt 12; $i++) {
  Start-Sleep 5
  $ep = Get-PnpDevice -Class AudioEndpoint -ErrorAction SilentlyContinue | Where-Object { $_.FriendlyName -like "*SOLSKYDD*" -and $_.Status -eq 'OK' }
  if ($ep) { $ok = $true; break }
}
$all = Get-PnpDevice -Class AudioEndpoint -ErrorAction SilentlyContinue | Where-Object { $_.FriendlyName -like "*SOLSKYDD*" }
$all | ForEach-Object { Write-Output ("endpoint: [" + $_.Status + "] " + $_.FriendlyName) }

if ($ok) {
  try {
    Import-Module AudioDeviceCmdlets -ErrorAction Stop
    $dev = Get-AudioDevice -List | Where-Object { $_.Type -eq 'Playback' -and $_.Name -like "*SOLSKYDD*" } | Select-Object -First 1
    if ($dev) {
      Set-AudioDevice -ID $dev.ID | Out-Null
      Set-AudioDevice -PlaybackVolume 80
      Write-Output ("DEFAULT IMPOSTATO: " + $dev.Name + " a volume 80%")
    } else { Write-Output "endpoint OK ma non in elenco riproduzione (strano)" }
  } catch { Write-Output ("Set-AudioDevice ERRORE: " + $_.Exception.Message) }
} else {
  Write-Output "la cassa NON si e' connessa: e' accesa, carica e in portata? (riprovo volentieri)"
}
'''

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=15)
sftp = c.open_sftp(); home = sftp.normalize(".")
with sftp.open(home + "/abt2.ps1", "w") as f: f.write(PS)
sftp.close()
_, o, e = c.exec_command('powershell -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\\abt2.ps1"', timeout=200)
print(o.read().decode(errors="replace"))
err = e.read().decode(errors="replace").strip()
if err: print("STDERR:", err[:400])
c.exec_command('del "%USERPROFILE%\\abt2.ps1"')
c.close()
