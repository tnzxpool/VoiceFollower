import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key")

def ct(cmd, timeout=60):
    _, out, err = c.exec_command(f"pct exec 130 -- bash -lc '{cmd}'", timeout=timeout)
    return out.read().decode(errors="replace").strip()

_, out, _ = c.exec_command("pct config 130")
print("=== pct config 130 ===")
print(out.read().decode(errors="replace").strip(), flush=True)
print("=== data/ contenuto ===")
print(ct("ls -la /opt/voicefollower/data; find /opt/voicefollower -maxdepth 2 -name \"*.db\" -o -maxdepth 2 -name \"*.sqlite*\" -o -maxdepth 2 -name \"*.json\" -path \"*data*\" 2>/dev/null | head"), flush=True)
print("=== voices contenuto ===")
print(ct("ls -la /vf/tts/voices"), flush=True)
print("=== rootfs size ===")
print(ct("df -h / | tail -1"), flush=True)
c.close()
