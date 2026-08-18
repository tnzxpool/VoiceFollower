"""Stato build2 + download."""
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
for title, cmd in [
    ("download (byte / wget vivo?)", "stat -c %s /srv/lavoro/vf/models/Qwen3.8-27B-IQ4_XS.gguf; pgrep -c wget || echo wget-finito"),
    ("build2.out", "cat /srv/lavoro/vf/build/build2.out 2>/dev/null"),
    ("coda cmake2.log", "tail -6 /srv/lavoro/vf/build/cmake2.log 2>/dev/null"),
]:
    _, o, e = c.exec_command(cmd, timeout=60)
    print(f"=== {title} ===\n{(o.read().decode(errors='replace')+e.read().decode(errors='replace')).strip()}\n")
c.close()
