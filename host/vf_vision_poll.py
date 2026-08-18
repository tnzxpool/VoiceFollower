# Log + progresso reale del download pip (dimensioni tmp/cache)
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
SH = ("tail -4 /vf/vision/install.log; "
      "pgrep -c -f 'pip install' ; "
      "du -sh /root/.cache/pip /tmp/pip-* /vf/vision/venv 2>/dev/null | tail -6")
_, o, e = c.exec_command("pct exec 130 -- bash -lc '" + SH + "'", timeout=30)
o.channel.recv_exit_status()
print(o.read().decode(errors="replace"))
c.close()
