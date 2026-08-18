"""Build llama.cpp take 2: hint CUDAToolkit per pacchetti Debian (/usr/include)."""
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BUILD = r"""#!/bin/bash
set -u
cd /vf/build/llama.cpp
rm -rf build
cmake -B build -DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES=61 -DLLAMA_CURL=OFF \
  -DCMAKE_CUDA_COMPILER=/usr/bin/nvcc -DCUDAToolkit_ROOT=/usr \
  -DCMAKE_CUDA_FLAGS=-allow-unsupported-compiler > /vf/build/cmake2.log 2>&1
rc=$?
echo "configure rc=$rc"
if [ $rc -ne 0 ]; then grep -iE 'error|fatal' /vf/build/cmake2.log | head -8; exit 1; fi
cmake --build build -j 8 --target llama-server >> /vf/build/cmake2.log 2>&1
echo "build rc=$?"
./build/bin/llama-server --version 2>&1 | head -2
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
sftp = c.open_sftp()
with sftp.open("/tmp/vf27_build2.sh", "w") as f:
    f.write(BUILD.replace("\r\n", "\n"))
sftp.close()
for title, cmd in [
    ("push", "pct push 130 /tmp/vf27_build2.sh /root/vf27_build2.sh --perms 755 && rm -f /tmp/vf27_build2.sh"),
    ("avvio", "pct exec 130 -- bash -c 'nohup /root/vf27_build2.sh > /vf/build/build2.out 2>&1 & echo avviata'"),
]:
    _, o, e = c.exec_command(cmd, timeout=60)
    rc = o.channel.recv_exit_status()
    print(f"=== {title} (rc={rc}) ===\n{(o.read().decode(errors='replace')+e.read().decode(errors='replace')).strip()}\n")
c.close()
