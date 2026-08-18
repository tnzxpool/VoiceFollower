"""Firewall PVE dedicato a CT 130 vf-host (il clone aveva ereditato quello di ai-core)."""
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST, USER, KEY = "192.168.1.88", "root", "H:/keys/tnzx_pve88_key"

FW = """[OPTIONS]
enable: 1
ipfilter: 1
macfilter: 1
policy_in: DROP
policy_out: DROP
log_level_in: warning
log_level_out: warning

[RULES]
# App VoiceFollower per kiosk (.4), master (.3) e dispositivi di casa.
IN ACCEPT -i net0 -source 192.168.1.0/24 -p tcp -dport 3000
# Backend modello (brain/prep/stt/tts/embed) per il master .3 e il kiosk .4.
IN ACCEPT -i net0 -source 192.168.1.0/24 -p tcp -dport 9101:9105
# Amministrazione SSH esclusivamente dal PC proprietario .3.
IN ACCEPT -i net0 -source 192.168.1.3 -p tcp -dport 22
# Diagnostica ICMP da PC proprietario e nodo Proxmox.
IN ACCEPT -i net0 -source 192.168.1.3 -p icmp
IN ACCEPT -i net0 -source 192.168.1.88 -p icmp

# Resolver del CT.
OUT DNS(ACCEPT) -i net0 -dest 1.1.1.1
OUT DNS(ACCEPT) -i net0 -dest 192.168.1.253
# NTP.
OUT ACCEPT -i net0 -dest 192.168.1.253 -p udp -dport 123
# Niente movimento laterale verso reti private.
OUT DROP -i net0 -dest 10.0.0.0/8
OUT DROP -i net0 -dest 172.16.0.0/12
OUT DROP -i net0 -dest 192.168.0.0/16
OUT DROP -i net0 -dest 169.254.0.0/16
# Aggiornamenti e provider cloud opzionali (Gemini/Anthropic via HTTPS).
OUT ACCEPT -i net0 -dest 0.0.0.0/0 -p tcp -dport 80
OUT ACCEPT -i net0 -dest 0.0.0.0/0 -p tcp -dport 443
OUT ACCEPT -i net0 -dest 0.0.0.0/0 -p udp -dport 123
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=10)

def run(title, cmd, timeout=60):
    _, o, e = c.exec_command(cmd, timeout=timeout)
    rc = o.channel.recv_exit_status()
    out = (o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip()
    print(f"=== {title} (rc={rc}) ===\n{out}\n")

sftp = c.open_sftp()
run("backup 130.fw ereditato", "cp /etc/pve/firewall/130.fw /root/130.fw.bak.ereditato-da-101 && echo bak-ok")
with sftp.open("/etc/pve/firewall/130.fw", "w") as f:
    f.write(FW)
sftp.close()
run("verifica nuovo 130.fw", "cat /etc/pve/firewall/130.fw | head -12")
run("ricarica firewall", "pve-firewall compile >/dev/null 2>&1; systemctl reload-or-restart pve-firewall; pve-firewall status")
run("test da host: app e brain", "sleep 2; curl -s --max-time 5 http://192.168.1.89:3000/api/health | head -c 60; echo; curl -s --max-time 5 http://192.168.1.89:9101/health; echo")
c.close()
