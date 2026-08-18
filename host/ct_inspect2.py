# Fotografia CT 130 parte 2: vf-brain + modelli vision
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
CMD = ("pct exec 130 -- bash -lc '"
       "echo === vf-brain.service; cat /etc/systemd/system/vf-brain.service 2>/dev/null; "
       "echo === units attive; systemctl list-units --type=service --state=running | grep -E \"vf-|voicefollower\"; "
       "echo === vision models; ls -lh /vf/vision/models /vf/vision/weights 2>/dev/null; "
       "echo === llama; ls /usr/local/bin/llama* 2>/dev/null'")
_, o, e = c.exec_command(CMD, timeout=40)
o.channel.recv_exit_status()
print((o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip())
c.close()
