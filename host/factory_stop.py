"""Spegne i container LXC della R740 AI Factory (101,120,121,122) liberando la P40.
NON tocca: 110 htnz-hosting1, 102 virtio. Mette onboot=0 sui container fermati."""
import paramiko

HOST, USER, KEY = "192.168.1.88", "root", "H:/keys/tnzx_pve88_key"
FACTORY = ["101", "120", "121", "122"]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=10)

def run(cmd, timeout=120):
    _, o, e = c.exec_command(cmd, timeout=timeout)
    return (o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip()

# 1. verifica: in quale container girano i processi GPU?
print("=== cgroup dei processi sulla GPU ===")
print(run("for p in $(nvidia-smi --query-compute-apps=pid --format=csv,noheader); do echo \"PID $p -> $(cat /proc/$p/cgroup | head -1)\"; done"))

# 2. spegni i container factory
for vmid in FACTORY:
    print(f"--> pct shutdown {vmid}")
    print(run(f"pct shutdown {vmid} --timeout 90", timeout=120) or "ok")
    print(run(f"pct set {vmid} --onboot 0") or "onboot=0")

# 3. stato finale
print("=== pct list ===")
print(run("pct list"))
print("=== GPU dopo lo spegnimento ===")
print(run("nvidia-smi --query-gpu=memory.used,memory.total --format=csv"))
print(run("nvidia-smi --query-compute-apps=pid,process_name --format=csv || echo 'nessun processo sulla GPU'"))
c.close()
