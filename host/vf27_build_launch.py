"""Lancia la build llama.cpp nel CT 130 in background (era rimasta a terra per il timeout)."""
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BUILD = r"""#!/bin/bash
set -u
mkdir -p /vf/build && cd /vf/build
if [ ! -d llama.cpp ]; then git clone --depth 1 https://github.com/ggml-org/llama.cpp.git 2>&1 | tail -1; fi
cd llama.cpp
cmake -B build -DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES=61 -DLLAMA_CURL=OFF > /vf/build/cmake.log 2>&1
cmake --build build -j 8 --target llama-server >> /vf/build/cmake.log 2>&1
echo "build rc=$?"
./build/bin/llama-server --version 2>&1 | head -2
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
sftp = c.open_sftp()
with sftp.open("/tmp/vf27_build.sh", "w") as f:
    f.write(BUILD.replace("\r\n", "\n"))
sftp.close()
for title, cmd in [
    ("push", "pct push 130 /tmp/vf27_build.sh /root/vf27_build.sh --perms 755 && rm -f /tmp/vf27_build.sh"),
    ("avvio", "pct exec 130 -- bash -c 'nohup /root/vf27_build.sh > /vf/build/build.out 2>&1 & echo avviata'"),
]:
    _, o, e = c.exec_command(cmd, timeout=60)
    rc = o.channel.recv_exit_status()
    print(f"=== {title} (rc={rc}) ===\n{(o.read().decode(errors='replace')+e.read().decode(errors='replace')).strip()}\n")
c.close()
