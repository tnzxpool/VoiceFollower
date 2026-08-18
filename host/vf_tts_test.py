# Test vf-tts: body JSON via file (niente quoting annidato), sintesi it, wav su H:
import json, paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
body = json.dumps({"text": "Ciao, oggi c'è un bel sole. Ti va se dopo pranzo ascoltiamo un po' di musica insieme?",
                   "language": "it"}, ensure_ascii=True)
sftp = c.open_sftp()
with sftp.open("/tmp/tts_body.json", "w") as f:
    f.write(body)
sftp.close()
CMD = ("pct push 130 /tmp/tts_body.json /tmp/tts_body.json && "
       "pct exec 130 -- bash -lc 'time curl -s -m 120 -X POST http://127.0.0.1:9107/tts "
       "-H \"Content-Type: application/json\" -d @/tmp/tts_body.json "
       "-o /vf/tts/test.wav -w \"http:%{http_code} gen:%{header_json}\\n\"; "
       "ls -lh /vf/tts/test.wav' && "
       "pct pull 130 /vf/tts/test.wav /tmp/vf_tts_test.wav")
_, o, e = c.exec_command(CMD, timeout=150)
o.channel.recv_exit_status()
print((o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip())
sftp = c.open_sftp()
sftp.get("/tmp/vf_tts_test.wav", "H:/VoiceFollower/host/tts_test.wav")
sftp.close()
print("salvato H:/VoiceFollower/host/tts_test.wav")
c.close()
