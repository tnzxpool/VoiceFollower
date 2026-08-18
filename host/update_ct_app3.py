"""Aggiorna l'app nel CT (regole shot 5e3b885): pull autenticato, build, restart, verifica."""
import paramiko, sys, re
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

token = None
with open("H:/VoiceFollower/credenziali.txt", encoding="utf-8", errors="replace") as f:
    for line in f:
        if line.startswith("GITHUB_TOKEN"):
            token = line.split("=", 1)[1].strip(); break

SCRIPT = r"""#!/bin/bash
set -u
cd /opt/voicefollower
git -c credential.helper='!f(){ echo username=tnzxpool; echo password=__TOKEN__; };f' pull --ff-only origin main 2>&1 | tail -2
echo "commit: $(git log --oneline -1)"
npm run build 2>&1 | tail -2
systemctl restart voicefollower
sleep 5
systemctl is-active voicefollower
rm -f /root/vf_update3.sh && echo script-rimosso
""".replace("__TOKEN__", token)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
sftp = c.open_sftp()
with sftp.open("/tmp/vf_update3.sh", "w") as f:
    f.write(SCRIPT.replace("\r\n", "\n"))
sftp.close()
for title, cmd in [
    ("push", "pct push 130 /tmp/vf_update3.sh /root/vf_update3.sh --perms 700 && rm -f /tmp/vf_update3.sh"),
    ("update", "pct exec 130 -- bash /root/vf_update3.sh"),
]:
    _, o, e = c.exec_command(cmd, timeout=240)
    rc = o.channel.recv_exit_status()
    out = (o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip()
    out = re.sub(r"ghp_[A-Za-z0-9]+", "ghp_***", out)
    print(f"=== {title} (rc={rc}) ===\n{out}\n")
c.close()
