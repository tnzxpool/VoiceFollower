"""Fase B: dentro CT 130 vf-host — via pct push + pct exec.
- stop+disable di TUTTI i servizi ai-* ereditati dal clone
- identita' nuova: machine-id azzerato, chiavi SSH host rigenerate, /etc/hosts
- unit vf-brain (9101, Qwen3-8B GPU), vf-prep (9102, qwen2.5-0.5b CPU), vf-embed (9105, GPU)
- attesa health + nvidia-smi
"""
import paramiko, sys

HOST, USER, KEY = "192.168.1.88", "root", "H:/keys/tnzx_pve88_key"

SETUP = r"""#!/bin/bash
set -u
echo '== stop/disable servizi factory =='
systemctl list-unit-files 'ai-*' --no-legend | awk '{print $1}' | grep '\.service$' > /tmp/ai_units
while read u; do systemctl stop "$u" 2>/dev/null; systemctl disable "$u" 2>/dev/null; done < /tmp/ai_units
systemctl reset-failed 2>/dev/null
echo "disabilitati: $(wc -l < /tmp/ai_units) servizi ai-*"

echo '== identita nuova =='
truncate -s0 /etc/machine-id
rm -f /var/lib/dbus/machine-id 2>/dev/null; ln -sf /etc/machine-id /var/lib/dbus/machine-id
rm -f /etc/ssh/ssh_host_*
ssh-keygen -A >/dev/null 2>&1 && echo 'chiavi SSH host rigenerate'
systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null
sed -i 's/ai-core/vf-host/g' /etc/hosts
grep vf-host /etc/hosts || echo '127.0.1.1 vf-host' >> /etc/hosts

echo '== rete esterna =='
curl -sI --max-time 10 https://deb.debian.org 2>&1 | head -1

echo '== unit vf =='
cat > /etc/systemd/system/vf-brain.service <<'EOF'
[Unit]
Description=VoiceFollower brain - Qwen3-8B Q4_K_M su P40 - porta 9101
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ai-factory
Group=ai-factory
Environment=LD_LIBRARY_PATH=/ai/environments/llama.cpp-p40/lib:/usr/lib/x86_64-linux-gnu
Environment=GGML_CUDA_NO_PINNED=0
ExecStart=/ai/environments/llama.cpp-p40/bin/llama-server --model /ai/models/Qwen3-8B-Q4_K_M.gguf --alias vf-brain --jinja --n-gpu-layers 99 --ctx-size 8192 --parallel 2 --host 0.0.0.0 --port 9101
Restart=on-failure
RestartSec=5s
TimeoutStartSec=300s
TimeoutStopSec=30s
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/vf-prep.service <<'EOF'
[Unit]
Description=VoiceFollower prep - qwen2.5-0.5b su CPU - porta 9102
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ai-factory
Group=ai-factory
Environment=LD_LIBRARY_PATH=/ai/environments/llama.cpp-p40/lib:/usr/lib/x86_64-linux-gnu
ExecStart=/ai/environments/llama.cpp-p40/bin/llama-server --model /ai/models/qwen2.5-0.5b-instruct-q4_0.gguf --alias vf-prep --n-gpu-layers 0 --threads 6 --ctx-size 4096 --parallel 2 --host 0.0.0.0 --port 9102
Restart=on-failure
RestartSec=5s
TimeoutStartSec=180s
LimitNOFILE=8192

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/vf-embed.service <<'EOF'
[Unit]
Description=VoiceFollower embedding - Qwen3-Embedding-0.6B - porta 9105
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ai-factory
Group=ai-factory
Environment=LD_LIBRARY_PATH=/ai/environments/llama.cpp-p40/lib:/usr/lib/x86_64-linux-gnu
Environment=GGML_CUDA_NO_PINNED=0
ExecStart=/ai/environments/llama.cpp-p40/bin/llama-server --model /ai/models/embeddings/Qwen3-Embedding-0.6B-Q8_0.gguf --alias vf-embed --n-gpu-layers 99 --ctx-size 4096 --batch-size 512 --ubatch-size 256 --parallel 1 --embedding --pooling last --host 0.0.0.0 --port 9105
Restart=on-failure
RestartSec=5s
TimeoutStartSec=180s
LimitNOFILE=8192

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now vf-brain vf-prep vf-embed

echo '== attesa health =='
declare -A UNIT=( [9101]=vf-brain [9102]=vf-prep [9105]=vf-embed )
for p in 9101 9102 9105; do
  ok=0
  for i in $(seq 1 30); do
    if curl -s --max-time 3 "http://127.0.0.1:$p/health" | grep -q ok; then ok=1; break; fi
    sleep 5
  done
  if [ $ok = 1 ]; then echo "porta $p (${UNIT[$p]}): OK"
  else echo "porta $p (${UNIT[$p]}): FAIL"; journalctl -u "${UNIT[$p]}" -n 15 --no-pager; fi
done

echo '== GPU =='
nvidia-smi --query-gpu=name,memory.used,memory.total --format=csv 2>&1
echo '== servizi attivi vf =='
systemctl --no-pager --no-legend list-units 'vf-*'
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=10)

sftp = c.open_sftp()
with sftp.open("/tmp/vf_setup_b.sh", "w") as f:
    f.write(SETUP.replace("\r\n", "\n"))
sftp.close()

def run(title, cmd, timeout=600):
    _, o, e = c.exec_command(cmd, timeout=timeout)
    rc = o.channel.recv_exit_status()
    out = (o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip()
    print(f"=== {title} (rc={rc}) ===\n{out}\n")
    return rc, out

run("push script nel CT", "pct push 130 /tmp/vf_setup_b.sh /root/vf_setup_b.sh --perms 755")
run("esecuzione setup B", "pct exec 130 -- bash /root/vf_setup_b.sh", timeout=900)
c.close()
print("FASE B COMPLETATA")
