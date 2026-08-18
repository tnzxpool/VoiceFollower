"""Debug rete: .89 raggiungibile dall'host .88? Firewall PVE? Confronto con CT 120."""
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST, USER, KEY = "192.168.1.88", "root", "H:/keys/tnzx_pve88_key"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=10)

def run(title, cmd, timeout=60):
    _, o, e = c.exec_command(cmd, timeout=timeout)
    rc = o.channel.recv_exit_status()
    out = (o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip()
    print(f"=== {title} (rc={rc}) ===\n{out}\n")

run("curl da host .88 verso .89", "curl -s --max-time 5 http://192.168.1.89:3000/api/health | head -c 120; echo; curl -s --max-time 5 http://192.168.1.89:9101/health; echo")
run("pve-firewall", "pve-firewall status; echo; cat /etc/pve/firewall/cluster.fw 2>/dev/null | head -30")
run("firewall CT", "ls /etc/pve/firewall/ 2>/dev/null; echo; cat /etc/pve/firewall/130.fw 2>/dev/null; echo '-- 120:'; cat /etc/pve/firewall/120.fw 2>/dev/null; echo '-- 101:'; cat /etc/pve/firewall/101.fw 2>/dev/null")
run("arp/bridge", "ip neigh | grep '1\\.89'; brctl show vmbr0 2>/dev/null | head -5")
run("ping .89 da host", "ping -c1 -W2 192.168.1.89 >/dev/null && echo PING-OK || echo PING-FAIL")
run("ping .3 da CT 130", "pct exec 130 -- bash -c 'ping -c1 -W2 192.168.1.3 >/dev/null && echo OK || echo FAIL; ip route'")
c.close()
