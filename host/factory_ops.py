"""Operazioni factory su Proxmox .88 via SSH (paramiko).

Uso: python H:/VoiceFollower/host/factory_ops.py [--shutdown]
- elenca le VM e individua quella con GPU passthrough (hostpci)
- con --shutdown: spegne SOLO quella VM (graceful) e mette onboot=0
- sonda anche gli IP candidati per la futura vf-host (.89 .91 .92 .93)
"""
import sys
import paramiko

HOST, USER, KEY = "192.168.1.88", "root", "H:/keys/tnzx_pve88_key"
CANDIDATES = ["192.168.1.89", "192.168.1.91", "192.168.1.92", "192.168.1.93"]


def run(c, cmd, timeout=60):
    _, o, e = c.exec_command(cmd, timeout=timeout)
    return o.read().decode(errors="replace"), e.read().decode(errors="replace")


def main() -> int:
    do_shutdown = "--shutdown" in sys.argv
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, key_filename=KEY, timeout=10)

    out, _ = run(c, "qm list")
    print("=== qm list ===")
    print(out)

    # individua VM con hostpci (GPU passthrough)
    gpu_vms = []
    for line in out.strip().splitlines()[1:]:
        parts = line.split()
        if len(parts) < 3:
            continue
        vmid, name, status = parts[0], parts[1], parts[2]
        cfg, _ = run(c, f"qm config {vmid} | grep -E 'hostpci|name'")
        if "hostpci" in cfg:
            gpu_vms.append((vmid, name, status, cfg.strip()))

    print("=== VM con GPU passthrough ===")
    for vmid, name, status, cfg in gpu_vms:
        print(f"VMID {vmid}  {name}  [{status}]\n  {cfg}")

    if do_shutdown:
        running = [v for v in gpu_vms if v[2] == "running"]
        if not running:
            print("Nessuna VM GPU in esecuzione: la P40 e' gia' libera.")
        for vmid, name, status, _ in running:
            print(f"--> shutdown VM {vmid} ({name})...")
            out, err = run(c, f"qm shutdown {vmid} --timeout 120", timeout=150)
            print(out or err)
            out, err = run(c, f"qm set {vmid} --onboot 0")
            print(out or err)
        out, _ = run(c, "qm list")
        print("=== qm list dopo lo shutdown ===")
        print(out)
        out, _ = run(c, "lspci -nnk | grep -A2 -i nvidia | head -8")
        print("=== GPU sul nodo ===")
        print(out)

    print("=== sonda IP candidati per vf-host ===")
    for ip in CANDIDATES:
        out, _ = run(c, f"ping -c1 -W1 {ip} >/dev/null 2>&1 && echo OCCUPATO || echo LIBERO")
        print(f"{ip}: {out.strip()}")
    out, _ = run(c, "ping -c1 -W1 192.168.1.90 >/dev/null 2>&1; arp -n 192.168.1.90 | tail -1")
    print(f"192.168.1.90 (dichiarato iDRAC): {out.strip()}")

    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
