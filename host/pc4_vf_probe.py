# Censimento tracce VoiceFollower su .4 (solo lettura)
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.4", username="sx", key_filename="H:/keys/tnzx_gpu_key", timeout=15)

def ps(cmd, timeout=60):
    full = 'powershell -NoProfile -Command "' + cmd.replace('"', '\\"') + '"'
    _, out, err = c.exec_command(full, timeout=timeout)
    o = out.read().decode(errors="replace").strip()
    e = err.read().decode(errors="replace").strip()
    return o if o else ("(vuoto)" if not e else "ERR: " + e[:200])

print("=== startup utente ===", flush=True)
print(ps("Get-ChildItem ([Environment]::GetFolderPath('Startup')) | Select-Object -Expand Name"), flush=True)
print("=== startup comune ===", flush=True)
print(ps("Get-ChildItem ([Environment]::GetFolderPath('CommonStartup')) | Select-Object -Expand Name"), flush=True)
print("=== temp ps1 ===", flush=True)
print(ps("Get-ChildItem $env:TEMP -Filter vf_kiosk* | Select-Object -Expand FullName"), flush=True)
print("=== desktop/download vf ===", flush=True)
print(ps("Get-ChildItem $env:USERPROFILE\\Desktop, $env:USERPROFILE\\Downloads -ErrorAction SilentlyContinue | Where-Object Name -match 'vf|voice|kiosk|edgemesh' | Select-Object -Expand FullName"), flush=True)
print("=== processi kiosk ===", flush=True)
print(ps("Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'kiosk|192.168.1.89' } | Select-Object ProcessId, Name | Format-Table -HideTableHeaders | Out-String"), flush=True)
c.close()
