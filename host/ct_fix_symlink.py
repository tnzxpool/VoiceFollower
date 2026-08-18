import paramiko, time
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key")

def run(cmd, timeout=60):
    _, out, err = c.exec_command(f"pct exec 130 -- bash -lc '{cmd}'", timeout=timeout)
    o = out.read().decode(errors="replace").strip()
    e = err.read().decode(errors="replace").strip()
    return out.channel.recv_exit_status(), o, e

print("ln:", run("ln -sfn /vf/models/Qwen3.8-27B-IQ4_XS.gguf /vf/models/vf-brain-current.gguf; ls -l /vf/models/vf-brain-current.gguf"))
print("restart:", run("systemctl restart vf-brain && echo OK"))
for i in range(30):
    rc, o, e = run("curl -s -o /dev/null -w %{http_code} --max-time 5 http://127.0.0.1:9101/health")
    if o == "200":
        print(f"health 200 dopo ~{i*10}s"); break
    time.sleep(10)
else:
    print("health KO dopo 300s")
    print(run("journalctl -u vf-brain -n 10 --no-pager")[1][-800:])
c.close()
