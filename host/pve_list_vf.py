# Censimento VM/CT su .88: cosa resta di VoiceFollower? (solo lettura)
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.1.88", username="root", key_filename="H:/keys/tnzx_pve88_key")

def host(cmd, timeout=60):
    _, out, err = c.exec_command(cmd, timeout=timeout)
    return out.read().decode(errors="replace").strip()

print("=== CT (pct list) ===")
print(host("pct list"), flush=True)
print("=== VM (qm list) ===")
print(host("qm list"), flush=True)
print("=== descrizioni/hostname con vf/voice/edgemesh ===")
print(host("grep -ril -E 'vf|voice|edgemesh' /etc/pve/lxc/ /etc/pve/qemu-server/ 2>/dev/null"), flush=True)
print("=== residui su disco host ===")
print(host("ls -d /srv/lavoro/vf /root/vf-* 2>/dev/null; ls /root | grep -i -E 'vf|voice' "), flush=True)
c.close()
