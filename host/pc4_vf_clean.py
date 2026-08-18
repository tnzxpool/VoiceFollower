# Pulizia tracce VoiceFollower su .4 (dopo ispezione del vbs)
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.4", username="sx", key_filename="H:/keys/tnzx_gpu_key", timeout=15)

def ps(cmd, timeout=60):
    full = 'powershell -NoProfile -Command "' + cmd.replace('"', '\\"') + '"'
    _, out, err = c.exec_command(full, timeout=timeout)
    o = out.read().decode(errors="replace").strip()
    e = err.read().decode(errors="replace").strip()
    return (o + (" | ERR: " + e[:200] if e else "")) or "(vuoto)"

print("=== contenuto start-intercom-listener.vbs ===", flush=True)
print(ps("Get-Content ([Environment]::GetFolderPath('Startup') + '\\start-intercom-listener.vbs')"), flush=True)
print("=== chiudo Edge in modalita kiosk ===", flush=True)
print(ps("Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'msedge.exe' -and $_.CommandLine -match '--kiosk|192.168.1.89' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; 'edge kiosk chiuso'"), flush=True)
print("=== cancello i file ===", flush=True)
print(ps("Remove-Item ([Environment]::GetFolderPath('CommonStartup') + '\\VoiceFollower-Kiosk.lnk') -Force; 'lnk comune rimosso'"), flush=True)
print(ps("Remove-Item $env:TEMP\\vf_kiosk_setup.ps1 -Force; 'temp ps1 rimosso'"), flush=True)
print(ps("Remove-Item $env:USERPROFILE\\Desktop\\KIOSK_4.bat -Force; 'KIOSK_4.bat rimosso'"), flush=True)
print("=== verifica finale ===", flush=True)
print(ps("Get-ChildItem ([Environment]::GetFolderPath('CommonStartup')), ([Environment]::GetFolderPath('Startup')), $env:USERPROFILE\\Desktop -ErrorAction SilentlyContinue | Where-Object Name -match 'vf|voice|kiosk|edgemesh' | Select-Object -Expand FullName"), flush=True)
c.close()
