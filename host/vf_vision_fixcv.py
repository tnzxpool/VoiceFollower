# opencv-python -> opencv-python-headless (CT senza X), poi restart + health
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
SH = ("/vf/vision/venv/bin/pip uninstall -y opencv-python -q; "
      "/vf/vision/venv/bin/pip install opencv-python-headless -q && "
      "systemctl restart vf-vision && sleep 15 && systemctl is-active vf-vision && "
      "curl -s http://127.0.0.1:9106/health")
_, o, e = c.exec_command("pct exec 130 -- bash -lc '" + SH + "'", timeout=240)
rc = o.channel.recv_exit_status()
print(o.read().decode(errors="replace"))
err = e.read().decode(errors="replace").strip()
if err: print("STDERR:", err[-400:])
print("rc =", rc)
c.close()
