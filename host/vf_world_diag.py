# Diagnosi startup world: processi, download cache CLIP, connessioni
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
CMD = ("pct exec 130 -- bash -lc '"
       "ps aux | grep -E \"uvicorn|python\" | grep -v grep | head -5; echo ---; "
       "ls -lhR /root/.cache 2>/dev/null | head -20; echo ---; "
       "ls -lh /vf/vision/*.pt /vf/vision/models 2>/dev/null; echo ---; "
       "ss -tnp 2>/dev/null | grep -E \"python|uvicorn\" | head -5; echo ---; "
       "top -bn1 | head -8'")
_, o, e = c.exec_command(CMD, timeout=35)
o.channel.recv_exit_status()
print((o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip())
c.close()
