# Setup vf-tts su CT 130: push servizio + script (nohup, log /vf/tts/setup.log):
# venv + torch cu118 (P40 sm_61) + coqui-tts + systemd vf-tts :9107.
# Lo script locale esce subito; poll con vf_tts_poll.py.
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

CT_SCRIPT = """#!/bin/bash
set -x
df -h /vf | tail -1
mkdir -p /vf/tts/models /vf/tts/voices
cd /vf/tts
[ -d venv ] || python3 -m venv venv
venv/bin/pip install -q --upgrade pip
venv/bin/pip install -q torch==2.2.2+cu118 torchaudio==2.2.2+cu118 \\
  --index-url https://download.pytorch.org/whl/cu118 2>&1 | tail -3
venv/bin/pip install -q coqui-tts fastapi uvicorn 2>&1 | tail -3
cat > /etc/systemd/system/vf-tts.service <<'EOF'
[Unit]
Description=vf-tts XTTS-v2 clonazione voce (porta 9107)
After=network.target

[Service]
WorkingDirectory=/vf/tts
Environment=COQUI_TOS_AGREED=1
Environment=TTS_HOME=/vf/tts/models
ExecStart=/vf/tts/venv/bin/uvicorn tts_service:app --host 0.0.0.0 --port 9107
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now vf-tts
sleep 10
systemctl is-active vf-tts
curl -s -m 5 http://127.0.0.1:9107/health
echo FINE-TTS-SETUP
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
sftp = c.open_sftp()
with open("H:/VoiceFollower/host/tts_service.py", encoding="utf-8") as f:
    svc = f.read().replace("\r\n", "\n")
with sftp.open("/tmp/tts_service.py", "w") as f:
    f.write(svc)
with sftp.open("/tmp/vf_tts_setup.sh", "w") as f:
    f.write(CT_SCRIPT)
sftp.close()

CMD = ("pct exec 130 -- mkdir -p /vf/tts && "
       "pct push 130 /tmp/tts_service.py /vf/tts/tts_service.py && "
       "pct push 130 /tmp/vf_tts_setup.sh /root/vf_tts_setup.sh && "
       "rm -f /tmp/tts_service.py /tmp/vf_tts_setup.sh && "
       "pct exec 130 -- bash -lc 'chmod +x /root/vf_tts_setup.sh && "
       "nohup /root/vf_tts_setup.sh > /vf/tts/setup.log 2>&1 & echo lanciato'")
_, o, e = c.exec_command(CMD, timeout=60)
rc = o.channel.recv_exit_status()
print(f"rc={rc}")
print((o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip())
c.close()
