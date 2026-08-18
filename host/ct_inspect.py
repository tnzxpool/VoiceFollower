# Fotografia CT 130 per l'installer riproducibile
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
CMD = ("pct exec 130 -- bash -lc '"
       "head -2 /etc/os-release; node -v; python3 --version; "
       "nvidia-smi --query-gpu=name,driver_version --format=csv,noheader; "
       "echo === voicefollower.service; cat /etc/systemd/system/voicefollower.service; "
       "echo === vf-vision.service; cat /etc/systemd/system/vf-vision.service; "
       "echo === layout; ls /vf/vision /vf/models 2>/dev/null; "
       "du -sh /vf/tts/models /vf/vision-venv 2>/dev/null; "
       "echo === env; cat /opt/voicefollower/.env 2>/dev/null; "
       "echo === data; ls /opt/voicefollower/data 2>/dev/null | head -8'")
_, o, e = c.exec_command(CMD, timeout=40)
o.channel.recv_exit_status()
print((o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip())
c.close()
