"""Coda del log di build llama.cpp nel CT."""
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
for title, cmd in [
    ("errori cmake.log", "grep -iE 'error|fatal' /srv/lavoro/vf/build/cmake.log | head -15"),
    ("coda cmake.log", "tail -25 /srv/lavoro/vf/build/cmake.log"),
]:
    _, o, e = c.exec_command(cmd, timeout=60)
    print(f"=== {title} ===\n{(o.read().decode(errors='replace')+e.read().decode(errors='replace')).strip()}\n")
c.close()
