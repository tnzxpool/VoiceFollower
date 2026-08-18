# Crea /srv/lavoro/vf/vision sul host mappato a root del CT, poi rilancia l'install
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
for title, cmd in [
    ("mkdir-host", "mkdir -p /srv/lavoro/vf/vision && chown 100000:100000 /srv/lavoro/vf/vision && ls -ld /srv/lavoro/vf/vision"),
    ("check-ct", "pct exec 130 -- bash -lc 'ls -ld /vf/vision && touch /vf/vision/.w && rm /vf/vision/.w && echo scrivibile-ok'"),
    ("launch", "pct exec 130 -- bash -lc 'sed -i \"s#/vf/vision-venv#/vf/vision/venv#g\" /root/vf_vision_install.sh; nohup bash /root/vf_vision_install.sh > /vf/vision/install.log 2>&1 & echo lanciato pid=$!'"),
]:
    _, o, e = c.exec_command(cmd, timeout=40)
    rc = o.channel.recv_exit_status()
    print(f"=== {title} (rc={rc}) ===")
    print((o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip())
c.close()
