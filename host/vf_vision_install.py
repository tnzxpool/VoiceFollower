# Lancia (staccata) l'installazione di vf-vision nel CT 130: venv + torch cu118 + ultralytics
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SCRIPT = r"""#!/bin/bash
set -u
echo "[$(date +%T)] inizio"
python3 -m venv /vf/vision-venv
V=/vf/vision-venv/bin/pip
$V install --upgrade pip -q
echo "[$(date +%T)] pip aggiornato, scarico torch cu118 (grosso)"
$V install torch torchvision --index-url https://download.pytorch.org/whl/cu118 -q
echo "[$(date +%T)] torch ok, installo ultralytics + fastapi"
$V install ultralytics fastapi uvicorn pillow python-multipart -q
echo "[$(date +%T)] pacchetti ok, verifica GPU"
/vf/vision-venv/bin/python - <<'PY'
import torch
print("torch", torch.__version__, "cuda", torch.version.cuda)
print("gpu-ok", torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else "-")
print("capability", torch.cuda.get_device_capability(0) if torch.cuda.is_available() else "-")
PY
echo "[$(date +%T)] FINE-INSTALL"
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
sftp = c.open_sftp()
with sftp.open("/tmp/vf_vision_install.sh", "w") as f:
    f.write(SCRIPT.replace("\r\n", "\n"))
sftp.close()
for title, cmd in [
    ("push", "pct push 130 /tmp/vf_vision_install.sh /root/vf_vision_install.sh --perms 700 && rm -f /tmp/vf_vision_install.sh"),
    ("launch", "pct exec 130 -- bash -lc 'nohup bash /root/vf_vision_install.sh > /vf/vision-install.log 2>&1 & echo lanciato pid=$!'"),
]:
    _, o, e = c.exec_command(cmd, timeout=60)
    rc = o.channel.recv_exit_status()
    print(f"=== {title} (rc={rc}) ===")
    print((o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip())
c.close()
