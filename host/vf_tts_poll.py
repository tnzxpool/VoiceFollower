# Poll setup/stato vf-tts: coda setup.log + stato servizio + health
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
CMD = ("pct exec 130 -- bash -lc 'tail -8 /vf/tts/fix.log 2>/dev/null; echo ---; "
       "systemctl is-active vf-tts 2>/dev/null; "
       "journalctl -u vf-tts -n 6 --no-pager 2>/dev/null | tail -6; echo ---; "
       "curl -s -m 5 http://127.0.0.1:9107/health'")
_, o, e = c.exec_command(CMD, timeout=35)
o.channel.recv_exit_status()
print((o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip())
c.close()
