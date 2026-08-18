# Backup dati vivi -> host .88 + H:, poi disinstallazione completa via uninstall-proxmox.sh
import paramiko, time
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key")

def host(cmd, timeout=180):
    _, out, err = c.exec_command(cmd, timeout=timeout)
    o = out.read().decode(errors="replace").strip()
    e = err.read().decode(errors="replace").strip()
    return out.channel.recv_exit_status(), o, e

sftp = c.open_sftp()
sftp.put("H:/VoiceFollower/install/backup-restore.sh", "/root/vf-backup-restore.sh")
sftp.put("H:/VoiceFollower/install/uninstall-proxmox.sh", "/root/vf-uninstall.sh")
# CRLF -> LF (file scritti da Windows)
host("sed -i 's/\\r$//' /root/vf-backup-restore.sh /root/vf-uninstall.sh")

print("=== 1. backup dentro il CT ===", flush=True)
rc, o, e = host("pct push 130 /root/vf-backup-restore.sh /tmp/br.sh && pct exec 130 -- bash /tmp/br.sh backup /tmp/vf-backup.tar.gz")
print(rc, o, e[:200], flush=True)
if rc != 0:
    print("STOP: backup fallito, NON disinstallo"); c.close(); raise SystemExit(1)

print("=== 2. tar fuori dal CT (host /root) ===", flush=True)
stamp = time.strftime("%Y%m%d-%H%M%S")
rc, o, e = host(f"pct pull 130 /tmp/vf-backup.tar.gz /root/vf-backup-{stamp}.tar.gz && ls -la /root/vf-backup-{stamp}.tar.gz")
print(rc, o, e[:200], flush=True)
if rc != 0:
    print("STOP: pull fallito, NON disinstallo"); c.close(); raise SystemExit(1)

print("=== 3. copia su H: ===", flush=True)
sftp.get(f"/root/vf-backup-{stamp}.tar.gz", f"H:/vf-backups/vf-backup-{stamp}.tar.gz")
print(f"H:/vf-backups/vf-backup-{stamp}.tar.gz", flush=True)

print("=== 4. disinstallazione ===", flush=True)
rc, o, e = host("bash /root/vf-uninstall.sh --yes", timeout=600)
print(rc, o, e[:300], flush=True)

print("=== 5. verifica ===", flush=True)
print("pct status:", host("pct status 130 2>&1")[1], flush=True)
print("vf dir:", host("ls /srv/lavoro/vf 2>&1")[1], flush=True)
print("ai dir intatta:", host("ls /srv/lavoro/ai | head -3")[1], flush=True)
print("driver host:", host("nvidia-smi --query-gpu=driver_version --format=csv,noheader")[1], flush=True)
sftp.close(); c.close()
