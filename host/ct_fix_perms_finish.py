import paramiko, time
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key")

def host(cmd, timeout=60):
    _, out, err = c.exec_command(cmd, timeout=timeout)
    o = out.read().decode(errors="replace").strip(); e = err.read().decode(errors="replace").strip()
    print(f"HOST$ {cmd}\n  rc={out.channel.recv_exit_status()} {o} {e}", flush=True)

def ct(cmd, timeout=60):
    _, out, err = c.exec_command(f"pct exec 130 -- bash -lc '{cmd}'", timeout=timeout)
    o = out.read().decode(errors="replace").strip(); e = err.read().decode(errors="replace").strip()
    rc = out.channel.recv_exit_status()
    print(f"CT$ {cmd}\n  rc={rc} {o[:300]} {e[:200]}", flush=True)
    return rc, o

# dirs scrivibili dall'app (root CT = 100000 host); solo quelle che servono ai download admin
host("chown 100000:100000 /srv/lavoro/vf/models /srv/lavoro/vf/vision/models /srv/lavoro/vf/tts/voices 2>&1; ls -ldn /srv/lavoro/vf/models /srv/lavoro/vf/vision/models /srv/lavoro/vf/tts/voices")

ct("ln -sfn /vf/models/Qwen3.8-27B-IQ4_XS.gguf /vf/models/vf-brain-current.gguf && ls -l /vf/models/vf-brain-current.gguf")
ct("systemctl restart vf-brain && echo restart-OK")
for i in range(30):
    rc, o = ct("curl -s -o /dev/null -w %{http_code} --max-time 5 http://127.0.0.1:9101/health")
    if o == "200":
        print(f"BRAIN OK dopo ~{i*10}s", flush=True); break
    time.sleep(10)
else:
    print("BRAIN KO dopo 300s", flush=True)
    ct("journalctl -u vf-brain -n 8 --no-pager")
c.close()
