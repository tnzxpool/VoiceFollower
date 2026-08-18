"""Pre-check per Qwen3.8-27B: versione llama.cpp factory, spazio disco .88, toolchain build."""
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST, USER, KEY = "192.168.1.88", "root", "H:/keys/tnzx_pve88_key"

CMDS = [
    ("versione llama-server factory (da CT 130)",
     "pct exec 130 -- bash -lc 'LD_LIBRARY_PATH=/ai/environments/llama.cpp-p40/lib /ai/environments/llama.cpp-p40/bin/llama-server --version 2>&1 | head -3'"),
    ("spazio /srv/lavoro su .88", "df -h /srv/lavoro"),
    ("contenuto /srv/lavoro", "ls /srv/lavoro"),
    ("build tools su .88", "which gcc cmake git nvcc 2>&1; ls /usr/local/cuda*/bin/nvcc 2>/dev/null; echo fine"),
    ("build tools nel CT 130", "pct exec 130 -- bash -lc 'which gcc cmake git nvcc; ls /usr/local/cuda*/bin/nvcc 2>/dev/null; echo fine'"),
    ("VRAM ora", "pct exec 130 -- nvidia-smi --query-gpu=memory.used,memory.total --format=csv"),
    ("altre build llama.cpp in /ai/environments", "ls /ai/environments 2>/dev/null"),
]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=10)
for title, cmd in CMDS:
    _, o, e = c.exec_command(cmd, timeout=60)
    rc = o.channel.recv_exit_status()
    out = (o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip()
    print(f"=== {title} (rc={rc}) ===\n{out}\n")
c.close()
