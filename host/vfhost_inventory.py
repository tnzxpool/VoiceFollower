"""Inventario su .88 per costruire vf-host: config di ai-core, storage, GPU, ID liberi."""
import paramiko

HOST, USER, KEY = "192.168.1.88", "root", "H:/keys/tnzx_pve88_key"

CMDS = [
    ("config ai-core (101)", "cat /etc/pve/lxc/101.conf"),
    ("storage", "pvesm status; echo; df -h | grep -E 'Filesystem|pve|rpool|local'"),
    ("RAM/CPU host", "free -g | head -2; nproc"),
    ("device GPU", "ls -l /dev/nvidia* 2>/dev/null; ls -l /dev/dri 2>/dev/null | head -5"),
    ("ID esistenti", "pct list | awk '{print $1}'; qm list | awk '{print $1}'"),
    ("dentro ai-core: servizi e modelli (mount senza avviare)",
     "pct mount 101 2>/dev/null; ls /var/lib/lxc/101/rootfs/ 2>/dev/null | head; "
     "R=$(pct mount 101 2>/dev/null | grep -o \"'.*'\" | tr -d \"'\"); echo ROOTFS=$R; "
     "find /var/lib/lxc/101/rootfs /mnt/pve -maxdepth 6 -name '*.gguf' 2>/dev/null | head -10"),
    ("unmount", "pct unmount 101 2>/dev/null || true"),
]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=10)
for title, cmd in CMDS:
    _, o, e = c.exec_command(cmd, timeout=60)
    out = (o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip()
    print(f"=== {title} ===\n{out}\n")
c.close()
