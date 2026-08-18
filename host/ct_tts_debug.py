import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key")

def ct(cmd, timeout=90):
    _, out, err = c.exec_command(f"pct exec 130 -- bash -lc '{cmd}'", timeout=timeout)
    o = out.read().decode(errors="replace").strip()
    return out.channel.recv_exit_status(), o

print("health 9107:", ct('curl -s --max-time 10 http://127.0.0.1:9107/health')[1], flush=True)
rc, o = ct('curl -s --max-time 60 -X POST -H "Content-Type: application/json" -d "{\\"text\\":\\"Prova diretta.\\",\\"language\\":\\"it\\"}" -o /tmp/t.wav -w "%{http_code}" http://127.0.0.1:9107/tts; head -c 300 /tmp/t.wav | strings | head -3')
print("tts diretto:", o, flush=True)
print("journal vf-tts:", ct("journalctl -u vf-tts -n 15 --no-pager -q | tail -12")[1][-900:], flush=True)
print("voices dir:", ct("ls -la /vf/tts/voices | head -6")[1], flush=True)
print("unit user:", ct("grep -E \"^(User|Group)=\" /etc/systemd/system/vf-tts.service; systemctl show vf-tts -p MainPID,ActiveState | tr \"\\n\" \" \"")[1], flush=True)
c.close()
