"""Trova cuda_runtime.h e cublas nel CT 130."""
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
for title, cmd in [
    ("cuda_runtime.h", "pct exec 130 -- bash -c 'find /usr /opt /ai -name cuda_runtime.h 2>/dev/null | head -5'"),
    ("cublas_v2.h", "pct exec 130 -- bash -c 'find /usr /opt /ai -name cublas_v2.h 2>/dev/null | head -5'"),
    ("nvcc reale", "pct exec 130 -- bash -c 'readlink -f /usr/bin/nvcc; nvcc --version | tail -2'"),
    ("pacchetti cuda", "pct exec 130 -- bash -c 'dpkg -l | grep -iE \"cuda|nvidia\" | head -12'"),
]:
    _, o, e = c.exec_command(cmd, timeout=90)
    print(f"=== {title} ===\n{(o.read().decode(errors='replace')+e.read().decode(errors='replace')).strip()}\n")
c.close()
