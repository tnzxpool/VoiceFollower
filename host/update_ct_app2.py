"""Riparazione pull nel CT: via il file untracked in conflitto, pull, build, restart, prova."""
import paramiko, sys, re
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST, USER, KEY = "192.168.1.88", "root", "H:/keys/tnzx_pve88_key"

token = None
with open("H:/VoiceFollower/credenziali.txt", encoding="utf-8", errors="replace") as f:
    for line in f:
        if line.startswith("GITHUB_TOKEN"):
            token = line.split("=", 1)[1].strip(); break

SCRIPT = r"""#!/bin/bash
set -u
cd /opt/voicefollower
echo '== stato working tree =='
git status --porcelain | head -5
rm -f public/collaudo.html   # untracked, arriva ora dal repo
echo '== pull =='
git -c credential.helper='!f(){ echo username=tnzxpool; echo password=__TOKEN__; };f' pull --ff-only origin main 2>&1 | tail -2
echo "commit: $(git log --oneline -1)"
grep -q PRIMARY_PROVIDER .env || echo 'PRIMARY_PROVIDER=local_ollama' >> .env
echo '== build =='
npm run build 2>&1 | tail -3
echo '== restart =='
systemctl restart voicefollower
sleep 5
systemctl is-active voicefollower
echo '== prova reale orchestrate =='
curl -s --max-time 120 -X POST http://127.0.0.1:3000/api/orchestrate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Non trovo i miei occhiali, aiutami"}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('modelUsed:', d.get('modelUsed')); print('executionMode:', d.get('executionMode')); print('spokenResponse:', (d.get('spokenResponse') or '')[:250])"
echo '== collaudo.html ancora servito? =='
curl -s --max-time 5 http://127.0.0.1:3000/collaudo.html | head -c 30; echo
rm -f /root/vf_update2.sh && echo script-rimosso
""".replace("__TOKEN__", token)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=10)
sftp = c.open_sftp()
with sftp.open("/tmp/vf_update2.sh", "w") as f:
    f.write(SCRIPT.replace("\r\n", "\n"))
sftp.close()

def run(title, cmd, timeout=900):
    _, o, e = c.exec_command(cmd, timeout=timeout)
    rc = o.channel.recv_exit_status()
    out = (o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip()
    out = re.sub(r"ghp_[A-Za-z0-9]+", "ghp_***", out)
    print(f"=== {title} (rc={rc}) ===\n{out}\n")

run("push script", "pct push 130 /tmp/vf_update2.sh /root/vf_update2.sh --perms 700 && rm -f /tmp/vf_update2.sh")
run("riparazione e update", "pct exec 130 -- bash /root/vf_update2.sh")
c.close()
