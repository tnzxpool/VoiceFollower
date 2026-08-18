#!/usr/bin/env bash
# backup-restore.sh — salva e ripristina i DATI VIVI di VoiceFollower:
# tutto ciò che NON è nel repo e NON si riscarica (data/, .env, campioni voce).
# I modelli NON entrano nel backup: si riscaricano con download-models.sh.
#
# Uso (dentro il CT):
#   bash backup-restore.sh backup  [/percorso/out.tar.gz]     # default /tmp/vf-backup-<data>.tar.gz
#   bash backup-restore.sh restore /percorso/backup.tar.gz
#
# Dall'host Proxmox, per portare il tar FUORI dal CT (es. prima di distruggerlo):
#   pct exec 130 -- bash /opt/voicefollower/install/backup-restore.sh backup /tmp/vf.tar.gz
#   pct pull 130 /tmp/vf.tar.gz /root/vf-backup.tar.gz
# E per rimetterlo dentro dopo una reinstallazione:
#   pct push 130 /root/vf-backup.tar.gz /tmp/vf.tar.gz
#   pct exec 130 -- bash /opt/voicefollower/install/backup-restore.sh restore /tmp/vf.tar.gz
set -euo pipefail
APP="${APP:-/opt/voicefollower}"
VOICES="${VOICES:-/vf/tts/voices}"

case "${1:-}" in
  backup)
    OUT="${2:-/tmp/vf-backup-$(date +%Y%m%d-%H%M%S).tar.gz}"
    TARGETS=()
    [ -d "$APP/data" ] && TARGETS+=("${APP#/}/data")
    [ -f "$APP/.env" ] && TARGETS+=("${APP#/}/.env")
    [ -d "$VOICES" ] && TARGETS+=("${VOICES#/}")
    [ ${#TARGETS[@]} -gt 0 ] || { echo "ERRORE: niente da salvare ($APP/data, $APP/.env, $VOICES assenti)"; exit 1; }
    tar -czf "$OUT" -C / "${TARGETS[@]}"
    echo "Backup creato: $OUT ($(du -h "$OUT" | cut -f1))"
    echo "Contenuto:"
    tar -tzf "$OUT"
    ;;
  restore)
    TAR="${2:?serve il percorso del tar: backup-restore.sh restore /percorso/backup.tar.gz}"
    [ -f "$TAR" ] || { echo "ERRORE: $TAR non esiste"; exit 1; }
    tar -xzf "$TAR" -C /
    echo "Ripristinato. Riavvia i servizi:"
    echo "  systemctl restart voicefollower vf-tts"
    ;;
  *)
    echo "Uso: $0 backup [out.tar.gz] | restore <backup.tar.gz>"
    exit 2
    ;;
esac
