# Verifica rapida stato #28 sul CT 130 (sola lettura + eventuale fix idempotente)
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key")

def run(cmd, timeout=60):
    _, out, err = c.exec_command(f"pct exec 130 -- bash -lc '{cmd}'", timeout=timeout)
    o = out.read().decode(errors="replace").strip()
    rc = out.channel.recv_exit_status()
    return rc, o

print("1 symlink:", run("readlink /vf/models/vf-brain-current.gguf || echo ASSENTE"))
print("2 unit:   ", run("grep -o \"\\-m /vf/models/[^ ]*\" /etc/systemd/system/vf-brain.service"))
print("3 brain:  ", run("systemctl is-active vf-brain; curl -s -o /dev/null -w %{http_code} --max-time 5 http://127.0.0.1:9101/health"))
print("4 app:    ", run("curl -s -o /dev/null -w %{http_code} --max-time 5 http://127.0.0.1:3000/api/health"))
print("5 api mod:", run("curl -s --max-time 5 http://127.0.0.1:3000/api/admin/models | head -c 400"))
c.close()
