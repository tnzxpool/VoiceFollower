"""Porta public/collaudo.html nel CT 130 (dist/ gia' buildata) e in public/ del clone remoto."""
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST, USER, KEY = "192.168.1.88", "root", "H:/keys/tnzx_pve88_key"
SRC = "H:/VoiceFollower/public/collaudo.html"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=10)

sftp = c.open_sftp()
sftp.put(SRC, "/tmp/collaudo.html")
sftp.close()

def run(title, cmd, timeout=60):
    _, o, e = c.exec_command(cmd, timeout=timeout)
    rc = o.channel.recv_exit_status()
    out = (o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip()
    print(f"=== {title} (rc={rc}) ===\n{out}\n")

run("push in dist e public del CT",
    "pct push 130 /tmp/collaudo.html /opt/voicefollower/dist/collaudo.html && "
    "pct exec 130 -- bash -c 'mkdir -p /opt/voicefollower/public && cp /opt/voicefollower/dist/collaudo.html /opt/voicefollower/public/' && "
    "rm -f /tmp/collaudo.html && echo push-ok")
run("verifica servita", "curl -s --max-time 5 http://192.168.1.89:3000/collaudo.html | head -c 80")
c.close()
