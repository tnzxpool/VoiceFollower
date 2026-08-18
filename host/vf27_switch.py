"""Switch vf-brain a Qwen3.8-27B IQ4_XS con la build nuova; l'unit vecchia resta
come vf-brain-8b.service (disabilitata) per tornare indietro in un comando."""
import paramiko, sys, time
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

UNIT = """[Unit]
Description=VoiceFollower brain - Qwen3.8-27B IQ4_XS (llama.cpp nuovo, P40)
After=network.target

[Service]
User=ai-factory
Environment=LD_LIBRARY_PATH=/vf/build/llama.cpp/build/bin
ExecStart=/vf/build/llama.cpp/build/bin/llama-server \\
  -m /vf/models/Qwen3.8-27B-IQ4_XS.gguf \\
  --alias vf-brain --jinja -ngl 99 --ctx-size 8192 --parallel 2 \\
  --temp 1.0 --top-p 0.95 --top-k 20 --min-p 0 \\
  --host 0.0.0.0 --port 9101
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
"""

SCRIPT = r"""#!/bin/bash
set -u
# 1. conserva l'unit vecchia come fallback esplicito
if [ ! -f /etc/systemd/system/vf-brain-8b.service ]; then
  cp /etc/systemd/system/vf-brain.service /etc/systemd/system/vf-brain-8b.service
  echo 'fallback salvato: vf-brain-8b.service (disabilitato)'
fi
# 2. installa la nuova unit
mv /root/vf-brain.service.new /etc/systemd/system/vf-brain.service
systemctl daemon-reload
systemctl restart vf-brain
echo 'riavviato, attendo il caricamento del modello...'
for i in $(seq 1 36); do
  sleep 5
  if curl -sf --max-time 3 http://127.0.0.1:9101/health >/dev/null; then echo "health OK dopo $((i*5))s"; break; fi
done
systemctl is-active vf-brain
nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader
rm -f /root/vf27_switch.sh
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
sftp = c.open_sftp()
with sftp.open("/tmp/vf-brain.service.new", "w") as f:
    f.write(UNIT.replace("\r\n", "\n"))
with sftp.open("/tmp/vf27_switch.sh", "w") as f:
    f.write(SCRIPT.replace("\r\n", "\n"))
sftp.close()
for title, cmd, to in [
    ("push unit", "pct push 130 /tmp/vf-brain.service.new /root/vf-brain.service.new && pct push 130 /tmp/vf27_switch.sh /root/vf27_switch.sh --perms 700 && rm -f /tmp/vf-brain.service.new /tmp/vf27_switch.sh", 60),
    ("switch", "pct exec 130 -- bash /root/vf27_switch.sh", 220),
]:
    _, o, e = c.exec_command(cmd, timeout=to)
    rc = o.channel.recv_exit_status()
    print(f"=== {title} (rc={rc}) ===\n{(o.read().decode(errors='replace')+e.read().decode(errors='replace')).strip()}\n")
c.close()
