"""Riavvio completo: chi e' loggato su .4, reboot CT 130 (prova autostart), poi reboot .4."""
import paramiko, sys, time
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

def ssh(host, user, key):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, username=user, key_filename=key, timeout=10)
    return c

def run(c, title, cmd, timeout=120, fatal=False):
    _, o, e = c.exec_command(cmd, timeout=timeout)
    rc = o.channel.recv_exit_status()
    out = (o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip()
    print(f"=== {title} (rc={rc}) ===\n{out}\n")
    if fatal and rc != 0:
        print("FATALE"); sys.exit(1)
    return out

# --- 1. chi e' alla console di .4 + profili
c4 = ssh("192.168.1.4", "sx", "H:/keys/tnzx_gpu_key")
run(c4, "utenti loggati su .4", "quser 2>&1 & dir C:\\Users /b")

# --- 2. reboot CT 130 e attesa servizi (prova della catena onboot)
c88 = ssh("192.168.1.88", "root", "H:/keys/tnzx_pve88_key")
run(c88, "reboot CT 130", "pct reboot 130", timeout=180, fatal=True)
print("attendo i servizi (max 5 min)...")
deadline = time.time() + 300
ok = ""
while time.time() < deadline:
    time.sleep(15)
    out = run(c88, "poll salute", "curl -s --max-time 4 http://192.168.1.89:3000/api/health | head -c 40; echo; curl -s --max-time 4 http://192.168.1.89:9101/health")
    if out.count('"status":"ok"') >= 2:
        ok = "SI"; break
print(f"vf-host tornato su dopo reboot: {ok or 'NO (controlla)'}")
c88.close()

# --- 3. reboot .4 (il kiosk riparte da solo al login)
run(c4, "reboot .4", "shutdown /r /t 5 /c \"Riavvio collaudo VoiceFollower\"")
c4.close()
print("Riavvio .4 lanciato. Al login il kiosk si apre da solo su .89.")
