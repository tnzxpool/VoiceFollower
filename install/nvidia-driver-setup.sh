#!/usr/bin/env bash
# ============================================================
# VoiceFollower — driver NVIDIA per host Proxmox e CT
#
#   bash nvidia-driver-setup.sh            → host Proxmox (kernel module + userland)
#   bash nvidia-driver-setup.sh --ct 130   → dentro il CT: SOLO userland,
#                                            STESSA versione dell'host, --no-kernel-modules
#
# Idempotente: se nvidia-smi già funziona alla versione attesa, non fa nulla.
# Valuta la versione di Proxmox/kernel, individua il ramo driver adatto alla
# GPU rilevata e scarica il .run da download.nvidia.com.
# ============================================================
set -euo pipefail
log(){ echo -e "\e[1;32m[nvidia]\e[0m $*"; }
warn(){ echo -e "\e[1;33m[nvidia]\e[0m $*"; }
die(){ echo -e "\e[1;31m[nvidia]\e[0m $*" >&2; exit 1; }

# Versione di riferimento per ramo (collaudata su P40 + Proxmox 8.4).
# Aggiornabile: NVIDIA_VERSION=xxx.yy.zz bash nvidia-driver-setup.sh
BRANCH_535_DEFAULT="535.261.03"   # Pascal/Volta/Turing legacy — P40 collaudato
BRANCH_550_DEFAULT="550.163.01"   # GPU recenti
NV_BASE="https://download.nvidia.com/XFree86/Linux-x86_64"

installed_version(){ nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>/dev/null | head -1 || true; }

download_run(){ # $1 = versione → scarica in /root se manca, echo path
  local V="$1" RUN="/root/NVIDIA-Linux-x86_64-$1.run"
  if [ ! -f "$RUN" ]; then
    log "Scarico driver $V da download.nvidia.com"
    curl -fL -o "$RUN" "$NV_BASE/$V/NVIDIA-Linux-x86_64-$V.run" || die "Download fallito: $NV_BASE/$V/"
  fi
  chmod +x "$RUN"; echo "$RUN"
}

# ---------------- modalità CT: solo userland, versione = host ----------------
if [ "${1:-}" = "--ct" ] || [ ! -e /etc/pve ]; then
  # Dentro un CT (o lanciato con --ct dall'host per il pct exec)
  HOST_V="${NVIDIA_VERSION:-}"
  if [ -z "$HOST_V" ] && [ -e /dev/nvidiactl ]; then
    # la versione host è leggibile da /proc nel CT
    HOST_V=$(sed -n 's/.*Module  \([0-9.]*\).*/\1/p' /proc/driver/nvidia/version 2>/dev/null | head -1 || true)
  fi
  [ -n "$HOST_V" ] || die "Versione host non determinabile: passa NVIDIA_VERSION=<versione di nvidia-smi sull'host>"
  CUR=$(installed_version)
  if [ "$CUR" = "$HOST_V" ]; then log "Userland $CUR già allineato all'host — niente da fare."; exit 0; fi
  [ -e /dev/nvidiactl ] || die "/dev/nvidiactl assente nel CT: manca il passthrough (vedi proxmox-install.sh)."
  RUN=$(download_run "$HOST_V")
  log "Installo userland $HOST_V (senza modulo kernel)"
  bash "$RUN" --no-kernel-modules --silent --no-questions
  nvidia-smi >/dev/null || die "nvidia-smi non funziona dopo l'installazione."
  log "OK: $(installed_version)"
  exit 0
fi

# ---------------- modalità host Proxmox ----------------
command -v pveversion >/dev/null || die "Questo non è un host Proxmox (pveversion assente). Per un CT usa --ct."
PVE=$(pveversion | sed -n 's/^pve-manager\/\([0-9.]*\).*/\1/p')
KERNEL=$(uname -r)
log "Proxmox $PVE — kernel $KERNEL"

GPU_LINE=$(lspci -nn | grep -iE 'vga|3d controller' | grep -i nvidia | head -1 || true)
[ -n "$GPU_LINE" ] || die "Nessuna GPU NVIDIA rilevata (lspci). Niente da installare."
log "GPU: $GPU_LINE"

# Scelta del ramo in base all'architettura (euristica sui nomi noti)
case "$GPU_LINE" in
  *P40*|*P100*|*"GTX 10"*|*GP10*|*V100*|*"Tesla T4"*|*TU1*)
    TARGET="${NVIDIA_VERSION:-$BRANCH_535_DEFAULT}" ;;   # Pascal/Volta/Turing → 535 (ultimo ramo che li supporta)
  *)
    TARGET="${NVIDIA_VERSION:-$BRANCH_550_DEFAULT}" ;;
esac
log "Ramo driver scelto: $TARGET"

CUR=$(installed_version)
if [ "$CUR" = "$TARGET" ]; then
  log "Driver $CUR già installato e funzionante — niente da fare (idempotente)."
  exit 0
fi
[ -n "$CUR" ] && warn "Driver presente ($CUR) ≠ target ($TARGET): reinstallo alla versione target."

log "Headers kernel per $KERNEL"
apt-get update -qq
apt-get install -y -qq "pve-headers-$KERNEL" build-essential || \
  apt-get install -y -qq pve-headers build-essential

# blacklist nouveau (una volta sola)
if [ ! -f /etc/modprobe.d/blacklist-nouveau.conf ]; then
  printf 'blacklist nouveau\noptions nouveau modeset=0\n' > /etc/modprobe.d/blacklist-nouveau.conf
  update-initramfs -u
  warn "nouveau blacklistato: se era caricato serve un reboot prima di rilanciare."
  lsmod | grep -q '^nouveau' && die "nouveau caricato: riavvia l'host e rilancia questo script."
fi

RUN=$(download_run "$TARGET")
log "Installo driver $TARGET (kernel module + userland)"
bash "$RUN" --silent --no-questions
nvidia-smi >/dev/null || die "nvidia-smi non funziona dopo l'installazione."
log "OK host: $(installed_version)"
log "Ora nel CT (stessa versione, senza modulo):"
log "  pct exec <ID> -- bash /opt/voicefollower/install/nvidia-driver-setup.sh --ct"
