#!/usr/bin/env bash
# uninstall-proxmox.sh — rimozione COMPLETA di VoiceFollower dall'host Proxmox.
# Distrugge il CT e cancella modelli/venv/build in $VF_HOST_DIR.
#
# NON tocca (per scelta):
#   - /srv/lavoro/ai            (mount read-only condiviso con altri servizi)
#   - il driver NVIDIA host    (può servire ad altro; l'installer è comunque idempotente)
#
# ⚠ PRIMA fai il backup dei dati vivi — vedi backup-restore.sh:
#   pct exec 130 -- bash /opt/voicefollower/install/backup-restore.sh backup /tmp/vf.tar.gz
#   pct pull 130 /tmp/vf.tar.gz /root/vf-backup.tar.gz
#
# Uso:  bash uninstall-proxmox.sh --yes
# Per ricreare tutto:  git clone https://github.com/tnzxpool/VoiceFollower && bash VoiceFollower/install/proxmox-install.sh
set -euo pipefail
CTID="${CTID:-130}"
VF_HOST_DIR="${VF_HOST_DIR:-/srv/lavoro/vf}"

[ "${1:-}" = "--yes" ] || {
  echo "Azione DISTRUTTIVA: elimina il CT $CTID e $VF_HOST_DIR."
  echo "Fai prima il backup (backup-restore.sh), poi rilancia con:  $0 --yes"
  exit 2
}

if pct status "$CTID" >/dev/null 2>&1; then
  pct stop "$CTID" >/dev/null 2>&1 || true
  pct destroy "$CTID" --purge
  echo "CT $CTID distrutto (config e disco eliminati)"
else
  echo "CT $CTID non esiste: ok"
fi

if [ -d "$VF_HOST_DIR" ]; then
  rm -rf "$VF_HOST_DIR"
  echo "Rimosso $VF_HOST_DIR (modelli, venv, build)"
else
  echo "$VF_HOST_DIR non esiste: ok"
fi

echo "Conservati: /srv/lavoro/ai, driver NVIDIA host, eventuali backup in /root."
echo "Disinstallazione completa."
