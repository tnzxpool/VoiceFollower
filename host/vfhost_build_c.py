"""Fase C: app VoiceFollower dentro CT 130.
- Node 22 (NodeSource), git
- clone repo con token (letto da credenziali.txt, MAI stampato), poi remote ripulito
- .env -> vf-brain locale 9101, npm install + build, unit voicefollower.service porta 3000
- verifica health app e pulizia script col token
"""
import paramiko, sys, re
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST, USER, KEY = "192.168.1.88", "root", "H:/keys/tnzx_pve88_key"

token = None
with open("H:/VoiceFollower/credenziali.txt", encoding="utf-8", errors="replace") as f:
    for line in f:
        if line.startswith("GITHUB_TOKEN"):
            token = line.split("=", 1)[1].strip()
            break
if not token:
    print("Token non trovato in credenziali.txt"); sys.exit(1)

SETUP = r"""#!/bin/bash
set -u
export DEBIAN_FRONTEND=noninteractive
echo '== pacchetti base =='
apt-get update -qq >/dev/null 2>&1
apt-get install -y -qq ca-certificates curl git >/dev/null 2>&1 && echo base-ok

echo '== Node 22 =='
if ! command -v node >/dev/null || [[ "$(node -v 2>/dev/null)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x 2>/dev/null | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null 2>&1
fi
echo "node $(node -v)  npm $(npm -v)"

echo '== clone app =='
if [ ! -d /opt/voicefollower/.git ]; then
  git clone --depth 1 https://tnzxpool:__TOKEN__@github.com/tnzxpool/VoiceFollower.git /opt/voicefollower 2>&1 | tail -1
fi
cd /opt/voicefollower
git remote set-url origin https://github.com/tnzxpool/VoiceFollower.git
echo "remote: $(git remote get-url origin)"
echo "commit: $(git log --oneline -1)"

echo '== .env =='
cat > .env <<'ENV'
# vf-host: cervello locale su questo stesso CT
LOCAL_LLM_ENDPOINT=http://127.0.0.1:9101/v1
LOCAL_LLM_MODEL=vf-brain
NODE_ENV=production
ENV
echo env-ok

echo '== npm install =='
npm install --no-audit --no-fund 2>&1 | tail -2

echo '== build =='
npm run build 2>&1 | tail -5

echo '== unit voicefollower =='
cat > /etc/systemd/system/voicefollower.service <<'EOF'
[Unit]
Description=VoiceFollower app (Express + dist) porta 3000
After=network-online.target vf-brain.service
Wants=network-online.target vf-brain.service

[Service]
Type=simple
WorkingDirectory=/opt/voicefollower
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/server.cjs
Restart=on-failure
RestartSec=5s
LimitNOFILE=8192

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now voicefollower
sleep 6
echo '== health app =='
curl -s --max-time 5 http://127.0.0.1:3000/api/health || journalctl -u voicefollower -n 20 --no-pager
echo
echo '== pulizia =='
rm -f /root/vf_setup_c.sh && echo script-rimosso
"""

SETUP = SETUP.replace("__TOKEN__", token)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=10)

sftp = c.open_sftp()
with sftp.open("/tmp/vf_setup_c.sh", "w") as f:
    f.write(SETUP.replace("\r\n", "\n"))
sftp.close()

def run(title, cmd, timeout=1800, hide=False):
    _, o, e = c.exec_command(cmd, timeout=timeout)
    rc = o.channel.recv_exit_status()
    out = (o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip()
    if hide:
        out = re.sub(r"ghp_[A-Za-z0-9]+", "ghp_***", out)
    print(f"=== {title} (rc={rc}) ===\n{out}\n")
    return rc, out

run("push script", "pct push 130 /tmp/vf_setup_c.sh /root/vf_setup_c.sh --perms 700 && rm -f /tmp/vf_setup_c.sh")
run("setup C", "pct exec 130 -- bash /root/vf_setup_c.sh", hide=True)
c.close()
print("FASE C COMPLETATA")
