"""Inventario 2: modelli su host, unit systemd di ai-core, binari llama, node."""
import paramiko

HOST, USER, KEY = "192.168.1.88", "root", "H:/keys/tnzx_pve88_key"

R = "/var/lib/lxc/101/rootfs"
CMDS = [
    ("modelli su host /srv/lavoro/ai", "ls -la /srv/lavoro/ai/ 2>/dev/null; echo ---; ls -la /srv/lavoro/ai/models/ 2>/dev/null; echo ---; du -sh /srv/lavoro/ai/models/*.gguf 2>/dev/null"),
    ("mount 101", "pct mount 101"),
    ("unit ai-qwen36", f"cat {R}/etc/systemd/system/ai-qwen36.service 2>/dev/null"),
    ("unit ai-embedding", f"cat {R}/etc/systemd/system/ai-embedding.service 2>/dev/null"),
    ("altre unit ai-*", f"ls {R}/etc/systemd/system/ | grep -iE 'ai|llama|ollama' 2>/dev/null"),
    ("binario llama-server", f"find {R}/ai -maxdepth 4 -name 'llama-server' 2>/dev/null; find {R}/opt {R}/usr/local -maxdepth 5 -name 'llama-server' 2>/dev/null"),
    ("node/npm nel CT", f"ls {R}/usr/bin/node {R}/usr/local/bin/node 2>/dev/null; ls {R}/root/.nvm/versions/node 2>/dev/null"),
    ("env dei servizi", f"ls {R}/etc/default/ 2>/dev/null | head; cat {R}/etc/default/ai-qwen36 2>/dev/null"),
    ("unmount", "pct unmount 101 || true"),
]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=10)
for title, cmd in CMDS:
    _, o, e = c.exec_command(cmd, timeout=60)
    out = (o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip()
    print(f"=== {title} ===\n{out}\n")
c.close()
