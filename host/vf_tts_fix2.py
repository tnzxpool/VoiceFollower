# Fix 2: transformers<5 (coqui-tts 0.27 usa API rimosse in transformers 5)
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
CMD = ("pct exec 130 -- bash -lc '"
       "systemctl stop vf-tts; "
       "/vf/tts/venv/bin/pip install -q \"transformers>=4.54,<5\" 2>&1 | tail -3; "
       "/vf/tts/venv/bin/python -c \"from TTS.api import TTS; print(chr(105)+chr(109)+chr(112)+chr(111)+chr(114)+chr(116)+chr(45)+chr(111)+chr(107))\" 2>&1 | tail -4; "
       "systemctl start vf-tts; sleep 8; systemctl is-active vf-tts'")
_, o, e = c.exec_command(CMD, timeout=40)
o.channel.recv_exit_status()
print((o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip())
c.close()
