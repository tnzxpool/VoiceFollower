# Restart vf-tts + attesa breve + progresso download
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
CMD = ("pct exec 130 -- bash -lc '"
       "systemctl restart vf-tts; sleep 20; "
       "du -sh /vf/tts/models; ss -tn state established | head -3; "
       "curl -s -m 5 http://127.0.0.1:9107/health'")
_, o, e = c.exec_command(CMD, timeout=40)
o.channel.recv_exit_status()
print((o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip())
c.close()
