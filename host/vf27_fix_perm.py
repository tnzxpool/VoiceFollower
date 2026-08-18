"""Chown /srv/lavoro/vf/build al mapping unprivileged e rilancio build."""
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
for title, cmd in [
    ("chown build", "chown -R 100000:100000 /srv/lavoro/vf/build && chmod 755 /srv/lavoro/vf /srv/lavoro/vf/models"),
    ("scrittura ok?", "pct exec 130 -- bash -c 'touch /vf/build/.w && rm /vf/build/.w && echo scrivibile'"),
    ("avvio build", "pct exec 130 -- bash -c 'nohup /root/vf27_build.sh > /vf/build/build.out 2>&1 & echo avviata'"),
]:
    _, o, e = c.exec_command(cmd, timeout=60)
    rc = o.channel.recv_exit_status()
    print(f"=== {title} (rc={rc}) ===\n{(o.read().decode(errors='replace')+e.read().decode(errors='replace')).strip()}\n")
c.close()
