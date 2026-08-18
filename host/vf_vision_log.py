# Journal del servizio vf-vision
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
_, o, e = c.exec_command("pct exec 130 -- bash -lc 'systemctl is-active vf-vision; journalctl -u vf-vision -n 40 --no-pager | tail -32'", timeout=30)
o.channel.recv_exit_status()
print(o.read().decode(errors="replace"))
c.close()
