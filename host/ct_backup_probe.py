import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key")

def ct(cmd, timeout=60):
    _, out, err = c.exec_command(f"pct exec 130 -- bash -lc '{cmd}'", timeout=timeout)
    o = out.read().decode(errors="replace").strip()
    return out.channel.recv_exit_status(), o

print("data dir:", ct("du -sh /opt/voicefollower/data 2>/dev/null || echo MANCA")[1], flush=True)
print("env:", ct("ls -la /opt/voicefollower/.env 2>/dev/null || echo MANCA")[1], flush=True)
print("voices:", ct("du -sh /vf/tts/voices 2>/dev/null || echo MANCA")[1], flush=True)
print("workdir unit:", ct("grep -E \"WorkingDirectory|EnvironmentFile\" /etc/systemd/system/voicefollower.service")[1], flush=True)
print("altri dati?:", ct("ls /opt/voicefollower | tr \"\\n\" \" \"")[1], flush=True)
print("host /srv/lavoro/vf:", flush=True)
_, out, _ = c.exec_command("du -sh /srv/lavoro/vf/* 2>/dev/null; pct config 130 | grep -E 'mp0|hostname'")
print(out.read().decode(errors="replace").strip(), flush=True)
c.close()
