"""Ispezione servizi factory sull'host Proxmox .88."""
import paramiko

HOST, USER, KEY = "192.168.1.88", "root", "H:/keys/tnzx_pve88_key"

CMDS = [
    ("GPU / processi sulla P40", "nvidia-smi 2>/dev/null | tail -20 || echo 'nvidia-smi assente'"),
    ("Container LXC", "pct list 2>/dev/null || true"),
    ("Docker", "docker ps --format '{{.Names}} {{.Ports}} {{.Status}}' 2>/dev/null || echo 'docker assente'"),
    ("Porte factory in ascolto", "ss -tlnp | grep -E ':(8080|8081|8448|11434|9000|5000)\\b' || echo 'nessuna'"),
    ("Servizi systemd sospetti", "systemctl list-units --type=service --state=running --no-pager --no-legend | grep -Ei 'ollama|factory|portal|ai|whisper|kokoro|llama|vllm' || echo 'nessuno'"),
]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=10)
for title, cmd in CMDS:
    _, o, e = c.exec_command(cmd, timeout=30)
    print(f"=== {title} ===")
    print((o.read().decode(errors='replace') or e.read().decode(errors='replace')).strip())
    print()
c.close()
