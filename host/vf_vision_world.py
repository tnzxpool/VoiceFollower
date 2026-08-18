# Upgrade vf-vision a open-vocabulary (YOLO-World v2): push servizio, lancia
# in CT (nohup, log su /vf/vision/world.log): pip CLIP + download modello +
# restart. Lo script locale esce subito; il poll si fa con vf_vision_poll.py
# o leggendo il log.
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

CT_SCRIPT = """#!/bin/bash
set -x
cd /vf/vision
venv/bin/pip install -q "git+https://github.com/ultralytics/CLIP.git" 2>&1 | tail -2
cd models
[ -f yolov8l-worldv2.pt ] || curl -sL -o yolov8l-worldv2.pt \\
  https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8l-worldv2.pt
ls -lh yolov8l-worldv2.pt
systemctl restart vf-vision
sleep 25
systemctl is-active vf-vision
curl -s http://127.0.0.1:9106/health
echo FINE-WORLD
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
sftp = c.open_sftp()
with open("H:/VoiceFollower/host/vision_service.py", encoding="utf-8") as f:
    svc = f.read().replace("\r\n", "\n")
with sftp.open("/tmp/vision_service.py", "w") as f:
    f.write(svc)
with sftp.open("/tmp/vf_world.sh", "w") as f:
    f.write(CT_SCRIPT)
sftp.close()

CMD = ("pct push 130 /tmp/vision_service.py /vf/vision/vision_service.py && "
       "pct push 130 /tmp/vf_world.sh /root/vf_world.sh && "
       "rm -f /tmp/vision_service.py /tmp/vf_world.sh && "
       "pct exec 130 -- bash -lc 'chmod +x /root/vf_world.sh && "
       "nohup /root/vf_world.sh > /vf/vision/world.log 2>&1 & echo lanciato'")
_, o, e = c.exec_command(CMD, timeout=60)
rc = o.channel.recv_exit_status()
print(f"rc={rc}")
print((o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip())
c.close()
