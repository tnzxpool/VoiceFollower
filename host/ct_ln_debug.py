import paramiko, sys
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key")

def run(cmd, timeout=30):
    _, out, err = c.exec_command(f"pct exec 130 -- bash -lc '{cmd}'", timeout=timeout)
    o = out.read().decode(errors="replace").strip()
    e = err.read().decode(errors="replace").strip()
    print(f"$ {cmd}\n  rc={out.channel.recv_exit_status()} out={o!r} err={e!r}", flush=True)

run("ls -ld /vf/models; mount | grep /vf | head -3")
run("ln -sv /vf/models/Qwen3.8-27B-IQ4_XS.gguf /vf/models/vf-brain-current.gguf")
run("ls -l /vf/models/ | tail -5")
c.close()
