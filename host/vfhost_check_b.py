"""Verifica stato fase B dentro CT 130 (stdout UTF-8 per evitare cp1252)."""
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST, USER, KEY = "192.168.1.88", "root", "H:/keys/tnzx_pve88_key"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=10)

def run(title, cmd, timeout=300):
    _, o, e = c.exec_command(cmd, timeout=timeout)
    rc = o.channel.recv_exit_status()
    out = (o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip()
    print(f"=== {title} (rc={rc}) ===\n{out}\n")
    return rc, out

run("servizi vf", "pct exec 130 -- systemctl --no-pager list-units 'vf-*' --all")
run("servizi ai residui attivi", "pct exec 130 -- bash -c \"systemctl --no-pager --no-legend list-units 'ai-*' --state=running | cat\"")
run("health 9101/9102/9105", "pct exec 130 -- bash -c 'for p in 9101 9102 9105; do echo -n \"porta $p: \"; curl -s --max-time 3 http://127.0.0.1:$p/health || echo FAIL; echo; done'")
run("GPU", "pct exec 130 -- nvidia-smi --query-gpu=name,memory.used,memory.total --format=csv")
run("identita", "pct exec 130 -- bash -c 'hostname; cat /etc/machine-id | head -c 40; echo; ls /etc/ssh/ssh_host_ed25519_key.pub 2>/dev/null && echo chiavi-ok'")
run("log vf-brain (coda)", "pct exec 130 -- journalctl -u vf-brain -n 10 --no-pager")
c.close()
