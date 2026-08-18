# Test end-to-end /api/tts/speak (app :3000 -> vf-tts :9107) dall'interno del CT
import json, paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
body = json.dumps({"text": "Prova della voce collegata al kiosk.", "language": "it"}, ensure_ascii=True)
sftp = c.open_sftp()
with sftp.open("/tmp/speak_body.json", "w") as f:
    f.write(body)
sftp.close()
CMD = ("pct push 130 /tmp/speak_body.json /tmp/speak_body.json && "
       "pct exec 130 -- bash -lc 'curl -s -m 60 -X POST http://127.0.0.1:3000/api/tts/speak "
       "-H \"Content-Type: application/json\" -d @/tmp/speak_body.json "
       "-o /tmp/speak_test.wav -D - -w \"http:%{http_code}\\n\" | grep -iE \"http:|x-gen|content-type\"; "
       "ls -lh /tmp/speak_test.wav'")
_, o, e = c.exec_command(CMD, timeout=90)
o.channel.recv_exit_status()
print((o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip())
c.close()
