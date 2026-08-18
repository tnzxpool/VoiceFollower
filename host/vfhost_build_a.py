"""Fase A: crea CT 130 vf-host su .88 clonando ai-core (101, spento).
- backup 101.conf, rimuove bind mounts (non clonabili), clona full, ripristina i bind su 101
- 130: hostname vf-host, IP 192.168.1.89/24, MAC nuovo, onboot 1, 8 core / 16G, mp0 /ai (ro)
- verifica righe GPU lxc.* nel conf, avvia, controlla IP e /ai
"""
import paramiko, sys

HOST, USER, KEY = "192.168.1.88", "root", "H:/keys/tnzx_pve88_key"

MP_101 = [
    ("mp0", "/srv/lavoro/comfyui-models,mp=/models,ro=1"),
    ("mp1", "/srv/lavoro/gpu-lab-output,mp=/output"),
    ("mp3", "/srv/lavoro/scarico,mp=/scarico"),
    ("mp4", "/srv/lavoro/cache,mp=/cache"),
    ("mp5", "/srv/lavoro/ai,mp=/ai"),
]

GPU_LINES = """lxc.cgroup2.devices.allow: c 195:* rwm
lxc.cgroup2.devices.allow: c 234:* rwm
lxc.cgroup2.devices.allow: c 239:* rwm
lxc.mount.entry: /dev/nvidia0 dev/nvidia0 none bind,optional,create=file
lxc.mount.entry: /dev/nvidiactl dev/nvidiactl none bind,optional,create=file
lxc.mount.entry: /dev/nvidia-modeset dev/nvidia-modeset none bind,optional,create=file
lxc.mount.entry: /dev/nvidia-uvm dev/nvidia-uvm none bind,optional,create=file
lxc.mount.entry: /dev/nvidia-uvm-tools dev/nvidia-uvm-tools none bind,optional,create=file
lxc.mount.entry: /dev/nvidia-caps dev/nvidia-caps none bind,optional,create=dir"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=10)

def run(title, cmd, timeout=120, fatal=True):
    _, o, e = c.exec_command(cmd, timeout=timeout)
    rc = o.channel.recv_exit_status()
    out = (o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip()
    print(f"=== {title} (rc={rc}) ===\n{out}\n")
    if fatal and rc != 0:
        print("FATALE: mi fermo qui."); c.close(); sys.exit(1)
    return out

# 0. pre-check: 130 non esiste, 101 spento
out = run("pre-check", "pct status 130 2>&1; pct status 101")
if "status: stopped" not in out:
    print("101 non e' spento: mi fermo."); c.close(); sys.exit(1)
if "Configuration file 'nodes/" not in out and "does not exist" not in out:
    print("ATTENZIONE: 130 sembra esistere gia'. Mi fermo."); c.close(); sys.exit(1)

# 1. backup conf 101
run("backup 101.conf", "cp /etc/pve/lxc/101.conf /root/101.conf.bak.$(date +%Y%m%d%H%M%S) && ls /root/101.conf.bak.*")

# 2. togli i bind mount da 101 (non clonabili)
run("rimuovo bind da 101", "pct set 101 --delete mp0,mp1,mp3,mp4,mp5")

# 3. clone full (24G su lvmthin, alcuni minuti)
run("clone 101 -> 130", "pct clone 101 130 --hostname vf-host --full 1 --storage local-lvm", timeout=900)

# 4. ripristina i bind su 101 (identico a prima)
cmd = "pct set 101 " + " ".join(f"-{k} {v}" for k, v in MP_101)
run("ripristino bind su 101", cmd)
run("verifica 101.conf", "cat /etc/pve/lxc/101.conf")

# 5. configura 130: rete .89 (MAC nuovo: hwaddr omesso), onboot, risorse, /ai in sola lettura
run("configuro 130", "pct set 130 -net0 name=eth0,bridge=vmbr0,firewall=1,gw=192.168.1.253,ip=192.168.1.89/24,type=veth "
    "-onboot 1 -cores 8 -memory 16384 -swap 2048 -mp0 /srv/lavoro/ai,mp=/ai,ro=1")

# 6. righe GPU: il clone potrebbe non copiarle -> verifica e appendi se mancano
out = run("controllo righe GPU in 130.conf", "cat /etc/pve/lxc/130.conf")
if "lxc.mount.entry: /dev/nvidia0" not in out:
    heredoc = f"cat >> /etc/pve/lxc/130.conf <<'EOF'\n{GPU_LINES}\nEOF"
    run("appendo righe GPU", heredoc)
    run("130.conf finale", "cat /etc/pve/lxc/130.conf")

# 7. avvio e verifica
run("avvio 130", "pct start 130", timeout=180)
run("attesa rete", "sleep 8")
run("verifica dentro 130", "pct exec 130 -- bash -lc 'hostname; ip -4 addr show eth0 | grep inet; ls /ai/models/ | head; ls -l /dev/nvidia0 2>&1'", fatal=False)
run("ping gateway da 130", "pct exec 130 -- bash -lc 'ping -c1 -W2 192.168.1.253 >/dev/null && echo GW-OK || echo GW-FAIL; getent hosts deb.debian.org >/dev/null && echo DNS-OK || echo DNS-FAIL'", fatal=False)
c.close()
print("FASE A COMPLETATA")
