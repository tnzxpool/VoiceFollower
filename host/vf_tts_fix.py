# Fix vf-tts: torch 2.7.1+cu118 (stessa versione di vf-vision, provata sul P40),
# poi restart servizio. Detached: log su /vf/tts/fix.log, poll con vf_tts_poll.py.
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

CT_SCRIPT = """#!/bin/bash
set -x
cd /vf/tts
venv/bin/pip install -q torch==2.7.1+cu118 torchaudio==2.7.1+cu118 \\
  --index-url https://download.pytorch.org/whl/cu118 2>&1 | tail -3
venv/bin/python -c "from TTS.api import TTS; print('import-ok')" 2>&1 | tail -3
systemctl restart vf-tts
sleep 10
systemctl is-active vf-tts
curl -s -m 5 http://127.0.0.1:9107/health
echo FINE-TTS-FIX
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
sftp = c.open_sftp()
with sftp.open("/tmp/vf_tts_fix.sh", "w") as f:
    f.write(CT_SCRIPT)
sftp.close()
CMD = ("pct push 130 /tmp/vf_tts_fix.sh /root/vf_tts_fix.sh && rm -f /tmp/vf_tts_fix.sh && "
       "pct exec 130 -- bash -lc 'chmod +x /root/vf_tts_fix.sh && "
       "nohup /root/vf_tts_fix.sh > /vf/tts/fix.log 2>&1 & echo lanciato' ; exit 0")
_, o, e = c.exec_command(CMD, timeout=30)
try:
    o.channel.recv_exit_status()
    print((o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip())
except Exception as ex:
    print(f"(canale: {ex}) — probabilmente lanciato, verificare col poll")
c.close()
