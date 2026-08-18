# Apre la 9106 (vf-vision) nel firewall Proxmox del CT 130 e verifica dal .3 poi
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
CMD = ("sed -i 's/dport 9101:9105/dport 9101:9106/; "
       "s#(brain/prep/stt/tts/embed)#(brain/prep/stt/tts/embed/vision)#' /etc/pve/firewall/130.fw && "
       "grep -n '9101:' /etc/pve/firewall/130.fw && pve-firewall compile >/dev/null 2>&1; pve-firewall status")
_, o, e = c.exec_command(CMD, timeout=40)
o.channel.recv_exit_status()
print(o.read().decode(errors="replace") + e.read().decode(errors="replace"))
c.close()
