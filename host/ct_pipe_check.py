# Controllo pipe: errori nei journal dei servizi + test funzionale app->tts e app->brain
import paramiko, json
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key")

def ct(cmd, timeout=90):
    _, out, err = c.exec_command(f"pct exec 130 -- bash -lc '{cmd}'", timeout=timeout)
    o = out.read().decode(errors="replace").strip()
    return out.channel.recv_exit_status(), o

print("=== ERRORI journal (ultime 24h, priorita err) ===", flush=True)
for s in ["voicefollower", "vf-brain", "vf-tts", "vf-vision", "vf-prep", "vf-embed"]:
    rc, o = ct(f"journalctl -u {s} -p err --since \"24 hours ago\" --no-pager -n 6 -q")
    print(f"[{s}] {'PULITO' if not o else o[:400]}", flush=True)

print("=== WARN/error testuali nel log app (ultime 24h) ===", flush=True)
rc, o = ct("journalctl -u voicefollower --since \"24 hours ago\" --no-pager -q | grep -iE \"error|fallit|econnrefused|timeout\" | tail -6")
print(o if o else "PULITO", flush=True)

print("=== PIPE app->tts (POST /api/tts/speak) ===", flush=True)
rc, o = ct('curl -s -o /dev/null -w "%{http_code} %{time_total}s" --max-time 60 -X POST -H "Content-Type: application/json" -d "{\\"text\\":\\"Controllo dei collegamenti in corso.\\",\\"language\\":\\"it\\"}" http://127.0.0.1:3000/api/tts/speak')
print(o, flush=True)

print("=== PIPE app->brain (POST /api/orchestrate) ===", flush=True)
rc, o = ct('curl -s --max-time 90 -X POST -H "Content-Type: application/json" -d "{\\"prompt\\":\\"Rispondi solo: ok\\"}" http://127.0.0.1:3000/api/orchestrate | head -c 300')
print(o, flush=True)

print("=== PIPE app->vision (GET /health via app env) ===", flush=True)
rc, o = ct('curl -s --max-time 15 http://127.0.0.1:9106/health | head -c 200')
print(o, flush=True)
c.close()
