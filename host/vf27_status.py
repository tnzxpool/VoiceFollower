"""Stato fase A: mp1, CT, /vf, download, build."""
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
for title, cmd in [
    ("mp1 in config", "grep -E '^mp[0-9]' /etc/pve/lxc/130.conf"),
    ("stato CT", "pct status 130"),
    ("app attiva", "pct exec 130 -- systemctl is-active voicefollower 2>&1"),
    ("/vf nel CT", "pct exec 130 -- ls /vf 2>&1"),
    ("download", "ls -la /srv/lavoro/vf/models/ 2>&1; pgrep -af wget | head -2"),
    ("build", "ls /srv/lavoro/vf/build/ 2>&1; tail -3 /srv/lavoro/vf/build/build.out 2>/dev/null"),
]:
    _, o, e = c.exec_command(cmd, timeout=60)
    rc = o.channel.recv_exit_status()
    print(f"=== {title} (rc={rc}) ===\n{(o.read().decode(errors='replace')+e.read().decode(errors='replace')).strip()}\n")
c.close()
