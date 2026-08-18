"""Fase A Qwen3.8-27B: storage rw /srv/lavoro/vf, bind /vf nel CT 130, riavvio CT,
download IQ4_XS in background su .88, build llama.cpp b10419+ in background nel CT."""
import paramiko, sys, time
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST, USER, KEY = "192.168.1.88", "root", "H:/keys/tnzx_pve88_key"
URL = "https://huggingface.co/bartowski/Qwen3.8-27B-GGUF/resolve/main/Qwen3.8-27B-IQ4_XS.gguf"

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
c.connect(HOST, username=USER, key_filename=KEY, timeout=10)

def run(title, cmd, timeout=120):
    _, o, e = c.exec_command(cmd, timeout=timeout)
    rc = o.channel.recv_exit_status()
    out = (o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip()
    print(f"=== {title} (rc={rc}) ===\n{out}\n")
    return rc, out

# 1. storage rw + bind mount
run("mkdir vf", "mkdir -p /srv/lavoro/vf/models /srv/lavoro/vf/build")
rc, out = run("config mp1 attuale", "grep -E '^mp[0-9]' /etc/pve/lxc/130.conf")
if "/srv/lavoro/vf" not in out:
    run("aggiungi mp1", "pct set 130 -mp1 /srv/lavoro/vf,mp=/vf")
    run("riavvia CT", "pct reboot 130", timeout=180)
    print("attendo che il CT torni su...")
    deadline = time.time() + 300
    while time.time() < deadline:
        _, o, _ = c.exec_command("pct exec 130 -- systemctl is-active voicefollower 2>/dev/null", timeout=30)
        if o.read().decode().strip() == "active":
            print("CT su, app attiva"); break
        time.sleep(10)
run("verifica /vf nel CT", "pct exec 130 -- ls /vf")

# 2. download in background su .88 (host, non CT)
run("avvio download IQ4_XS", 
    f"cd /srv/lavoro/vf/models && nohup wget -c -q '{URL}' -O Qwen3.8-27B-IQ4_XS.gguf > /dev/null 2>&1 & echo avviato pid $!")

# 3. build in background nel CT
sftp = c.open_sftp()
with sftp.open("/tmp/vf27_build.sh", "w") as f:
    f.write(BUILD.replace("\r\n", "\n"))
sftp.close()
run("push build script", "pct push 130 /tmp/vf27_build.sh /vf/build/vf27_build.sh --perms 755 && rm -f /tmp/vf27_build.sh")
run("avvio build", "pct exec 130 -- bash -c 'nohup /vf/build/vf27_build.sh > /vf/build/build.out 2>&1 & echo avviata'")
c.close()
print("Fase A lanciata: download e build corrono in background.")
