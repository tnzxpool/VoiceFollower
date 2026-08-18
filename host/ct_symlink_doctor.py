# Allinea vf-brain al symlink vf-brain-current.gguf sul CT 130 e lancia doctor.sh
import paramiko, time

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key")

def run(cmd, timeout=120):
    _, out, err = c.exec_command(f"pct exec 130 -- bash -lc '{cmd}'", timeout=timeout)
    o = out.read().decode(errors="replace")
    e = err.read().decode(errors="replace")
    rc = out.channel.recv_exit_status()
    return rc, o, e

# 1. symlink al modello attuale (idempotente)
rc, o, e = run("ln -sfn /vf/models/Qwen3.8-27B-IQ4_XS.gguf /vf/models/vf-brain-current.gguf && ls -l /vf/models/vf-brain-current.gguf")
print("SYMLINK:", rc, o.strip(), e.strip())

# 2. unit: -m path -> symlink (solo se ancora hardcodato)
rc, o, e = run("grep -q vf-brain-current /etc/systemd/system/vf-brain.service && echo GIA-OK || (sed -i \"s|-m /vf/models/Qwen3.8-27B-IQ4_XS.gguf|-m /vf/models/vf-brain-current.gguf|\" /etc/systemd/system/vf-brain.service && systemctl daemon-reload && systemctl restart vf-brain && echo AGGIORNATO)")
print("UNIT:", rc, o.strip(), e.strip())

# 3. attesa caricamento modello + health
for i in range(24):
    rc, o, e = run("curl -s -o /dev/null -w %{http_code} --max-time 5 http://127.0.0.1:9101/health")
    if o.strip() == "200":
        print(f"BRAIN HEALTH: 200 dopo ~{i*10}s")
        break
    time.sleep(10)
else:
    print("BRAIN HEALTH: non risponde dopo 240s — controllare journal")

# 4. doctor
rc, o, e = run("bash /opt/voicefollower/install/doctor.sh", timeout=180)
print("=== DOCTOR (exit", rc, ") ===")
print(o)
if e.strip():
    print("STDERR:", e[-500:])
c.close()
