# Deploy vf-vision: push servizio, scarica yolo11m, unit systemd, avvio, health
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

UNIT = """[Unit]
Description=vf-vision YOLO11 (porta 9106)
After=network.target

[Service]
WorkingDirectory=/vf/vision
Environment=VF_YOLO_MODEL=/vf/vision/models/yolo11m.pt
ExecStart=/vf/vision/venv/bin/uvicorn vision_service:app --host 0.0.0.0 --port 9106
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
sftp = c.open_sftp()
with open("H:/VoiceFollower/host/vision_service.py", encoding="utf-8") as f:
    svc = f.read().replace("\r\n", "\n")
with sftp.open("/tmp/vision_service.py", "w") as f:
    f.write(svc)
with sftp.open("/tmp/vf-vision.service", "w") as f:
    f.write(UNIT)
sftp.close()

STEPS = [
    ("push", "pct push 130 /tmp/vision_service.py /vf/vision/vision_service.py && "
             "pct push 130 /tmp/vf-vision.service /etc/systemd/system/vf-vision.service && "
             "rm -f /tmp/vision_service.py /tmp/vf-vision.service && echo push-ok"),
    ("modello", "pct exec 130 -- bash -lc 'mkdir -p /vf/vision/models && cd /vf/vision/models && "
                "[ -f yolo11m.pt ] || curl -sL -o yolo11m.pt "
                "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolo11m.pt; ls -lh'"),
    ("avvio", "pct exec 130 -- bash -lc 'systemctl daemon-reload && systemctl enable --now vf-vision && sleep 8 && systemctl is-active vf-vision'"),
    ("health", "pct exec 130 -- bash -lc 'sleep 5; curl -s http://127.0.0.1:9106/health || journalctl -u vf-vision -n 15 --no-pager'"),
]
for title, cmd in STEPS:
    _, o, e = c.exec_command(cmd, timeout=300)
    rc = o.channel.recv_exit_status()
    print(f"=== {title} (rc={rc}) ===")
    print((o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip())
c.close()
