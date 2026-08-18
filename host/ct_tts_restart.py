import paramiko, time
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key")

def ct(cmd, timeout=120):
    _, out, err = c.exec_command(f"pct exec 130 -- bash -lc '{cmd}'", timeout=timeout)
    o = out.read().decode(errors="replace").strip()
    return out.channel.recv_exit_status(), o

print("VRAM prima:", ct("nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader")[1], flush=True)
print("restart:", ct("systemctl restart vf-tts && echo OK")[1], flush=True)
for i in range(20):
    rc, o = ct('curl -s --max-time 8 http://127.0.0.1:9107/health')
    if '"ok":true' in o:
        print(f"health ok dopo ~{i*10}s", flush=True); break
    time.sleep(10)
rc, o = ct('curl -s --max-time 90 -X POST -H "Content-Type: application/json" -d "{\\"text\\":\\"Adesso funziona di nuovo tutto.\\",\\"language\\":\\"it\\"}" -o /tmp/t2.wav -w "%{http_code}" http://127.0.0.1:9107/tts')
print("tts diretto:", o, flush=True)
rc, o = ct('curl -s -o /dev/null -w "%{http_code} %{time_total}s" --max-time 90 -X POST -H "Content-Type: application/json" -d "{\\"text\\":\\"Controllo dal kiosk superato.\\",\\"language\\":\\"it\\"}" http://127.0.0.1:3000/api/tts/speak')
print("pipe app->tts:", o, flush=True)
print("VRAM dopo:", ct("nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader")[1], flush=True)
c.close()
