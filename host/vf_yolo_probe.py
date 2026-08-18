# Probe CT 130 prima di installare YOLO: python, disco, GPU, spazio modelli
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SH = r"""
echo '--- python ---'; python3 --version 2>&1
python3 -m venv --help >/dev/null 2>&1 && echo venv-ok || echo venv-MISSING
echo '--- disk ---'; df -h /vf 2>/dev/null || df -h /
echo '--- gpu ---'; nvidia-smi --query-gpu=name,memory.used,memory.total --format=csv,noheader 2>&1 | head -3
echo '--- libcuda ---'; ls /usr/lib/x86_64-linux-gnu/libcuda.so* 2>/dev/null | head -3
echo '--- /vf ---'; ls /vf 2>/dev/null
echo '--- ports ---'; ss -ltn | grep -E '910[0-9]' || echo nessuna-porta-910x
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
cmd = "pct exec 130 -- bash -lc " + "'" + SH.replace("'", "'\\''") + "'"
_, o, e = c.exec_command(cmd, timeout=90)
rc = o.channel.recv_exit_status()
print(o.read().decode(errors="replace"))
err = e.read().decode(errors="replace").strip()
if err: print("STDERR:", err)
print("rc =", rc)
c.close()
