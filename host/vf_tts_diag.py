# Diag vf-tts: dove sta scaricando? processo vivo? journal recente
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key", timeout=10)
CMD = ("pct exec 130 -- bash -lc '"
       "ps aux | grep uvicorn | grep -v grep; echo ---; "
       "du -sh /root/.local/share/tts /root/.cache/huggingface /root/.cache 2>/dev/null; echo ---; "
       "journalctl -u vf-tts --since \"-3 min\" --no-pager | tail -10'")
_, o, e = c.exec_command(CMD, timeout=30)
o.channel.recv_exit_status()
print((o.read().decode(errors="replace") + e.read().decode(errors="replace")).strip())
c.close()
