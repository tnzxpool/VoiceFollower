# Diagnosi: detect con codice HTTP, porta 9106 da host, firewall
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
CMDS = [
 ("detect-ct", "pct exec 130 -- bash -lc 'A=/vf/vision/venv/lib/python3.11/site-packages/ultralytics/assets; "
               "curl -s -w \"\\nHTTP:%{http_code} t:%{time_total}s\\n\" -F image=@$A/bus.jpg http://127.0.0.1:9106/detect | head -c 900'"),
 ("porta-da-host", "curl -s -m 5 http://192.168.1.89:9106/health; echo; echo host-exit=$?"),
 ("bind", "pct exec 130 -- bash -lc 'ss -ltnp | grep 9106'"),
 ("fw", "pct exec 130 -- bash -lc 'iptables -L INPUT -n 2>/dev/null | head -8; nft list ruleset 2>/dev/null | head -12'"),
]
for t, cmd in CMDS:
    _, o, e = c.exec_command(cmd, timeout=120)
    o.channel.recv_exit_status()
    print(f"=== {t} ===")
    print((o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip())
c.close()
