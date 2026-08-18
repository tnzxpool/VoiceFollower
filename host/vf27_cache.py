"""Aggiunge --cache-reuse 256 a vf-brain (riuso della cache del prompt tra
richieste: il system prompt lungo non viene rielaborato ogni volta)."""
import paramiko, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HOST, USER, KEY = "192.168.1.88", "root", "H:/keys/tnzx_pve88_key"

SH = r'''
set -e
U=/etc/systemd/system/vf-brain.service
if ! grep -q "cache-reuse" "$U"; then
  sed -i 's|--reasoning-budget 0|--reasoning-budget 0 --cache-reuse 256|' "$U"
  echo "unit aggiornata: --cache-reuse 256"
else
  echo "gia' presente"
fi
systemctl daemon-reload
systemctl restart vf-brain
for i in $(seq 1 36); do
  if curl -s -m 3 http://127.0.0.1:9101/health | grep -q ok; then echo "health OK dopo $((i*5))s"; break; fi
  sleep 5
done
systemctl is-active vf-brain
'''
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, key_filename=KEY, timeout=15)
cmd = "pct exec 130 -- bash -lc " + "'" + SH.replace("'", "'\\''") + "'"
_, o, e = c.exec_command(cmd, timeout=220)
print(o.read().decode(errors="replace"))
err = e.read().decode(errors="replace").strip()
if err: print("STDERR:", err[:400])
c.close()
