#!/usr/bin/env bash
# ============================================================================
# proxmox-install.sh — Installazione VoiceFollower su un host Proxmox VE nudo.
#
# Cosa fa (interattivo, idempotente):
#   1. controlla i prerequisiti (pve, template Debian 12, GPU NVIDIA opzionale)
#   2. ti fa SCEGLIERE lo storage (dischi) tra quelli disponibili
#   3. crea il container LXC "vf-host" (unprivileged, nesting) con bind mount /vf
#   4. se c'è una GPU NVIDIA: aggiunge il passthrough dei device nel CT
#   5. lancia dentro il CT install/ct-bootstrap.sh → app funzionante SENZA LLM
#
# I modelli (voce, visione, cervello locale) NON vengono scaricati qui:
# si installano DOPO con la procedura guidata  install/download-models.sh
# (rilanciabile: la lista è install/models.json, aggiornabile dall'admin).
#
# Uso (sull'host Proxmox, come root):
#   bash proxmox-install.sh
# ============================================================================
set -euo pipefail

REPO_URL="${VF_REPO_URL:-https://github.com/tnzxpool/VoiceFollower}"
CT_HOSTNAME=vf-host
TEMPLATE_NAME=debian-12-standard

log(){ echo -e "\033[1;32m[vf-install]\033[0m $*"; }
die(){ echo -e "\033[1;31m[ERRORE]\033[0m $*" >&2; exit 1; }
ask(){ local q="$1" d="$2" a; read -rp "$q [$d]: " a; echo "${a:-$d}"; }

command -v pct >/dev/null || die "Questo script va eseguito sull'HOST Proxmox (pct non trovato)."
[ "$(id -u)" = 0 ] || die "Serve root."

# ---------------------------------------------------------------- 1. GPU?
GPU=0
if command -v nvidia-smi >/dev/null && nvidia-smi -L >/dev/null 2>&1; then
  GPU=1
  log "GPU trovata: $(nvidia-smi -L | head -1)"
elif lspci -nn 2>/dev/null | grep -iE 'vga|3d controller' | grep -qi nvidia; then
  # GPU fisica presente ma driver assente: lo script valuta la versione di
  # Proxmox/kernel, sceglie il ramo driver per la GPU e lo scarica/installa.
  log "GPU NVIDIA rilevata ma driver assente: lancio nvidia-driver-setup.sh"
  bash "$(dirname "$0")/nvidia-driver-setup.sh" && GPU=1 || \
    log "Driver non installato (vedi sopra): proseguo in modalità SOLO-CPU."
else
  log "Nessuna GPU NVIDIA sull'host: installazione in modalità SOLO-CPU."
  log "(l'app funziona; voce clonata/visione/cervello locale richiederanno la GPU)"
fi

# ---------------------------------------------------------------- 2. STORAGE
log "Storage disponibili:"
pvesm status | awk 'NR==1 || $3=="active"'
STORAGE_CT=$(ask "Storage per il DISCO del container (rootdir)" "local-lvm")
pvesm status | awk '$3=="active"{print $1}' | grep -qx "$STORAGE_CT" || die "Storage '$STORAGE_CT' non attivo."
DISK_GB=$(ask "Dimensione disco CT in GB (app+venv; i modelli stanno su /vf)" "24")
VF_HOST_DIR=$(ask "Cartella host per dati/modelli (bind mount → /vf nel CT)" "/srv/lavoro/vf")
CTID=$(ask "ID del container" "130")
pct status "$CTID" >/dev/null 2>&1 && die "CT $CTID esiste già. Scegli un altro ID o rimuovilo."

# ---------------------------------------------------------------- 3. RETE
BRIDGE=$(ask "Bridge di rete" "vmbr0")
IPCIDR=$(ask "IP del CT (CIDR) — 'dhcp' per automatico" "dhcp")
GW=""
if [ "$IPCIDR" != "dhcp" ]; then GW=$(ask "Gateway" "192.168.1.1"); fi
CORES=$(ask "Core CPU" "8")
MEM=$(ask "RAM in MB" "16384")

# ---------------------------------------------------------------- 4. TEMPLATE
pveam update >/dev/null
TPL=$(pveam available --section system | awk "/$TEMPLATE_NAME/{print \$2}" | sort | tail -1)
[ -n "$TPL" ] || die "Template $TEMPLATE_NAME non trovato in pveam."
TPL_STORE=$(pvesm status | awk '$2~/dir/ && $3=="active"{print $1; exit}')
TPL_STORE=${TPL_STORE:-local}
if ! pveam list "$TPL_STORE" | grep -q "$TPL"; then
  log "Scarico template $TPL su $TPL_STORE"
  pveam download "$TPL_STORE" "$TPL"
fi

# ---------------------------------------------------------------- 5. CREAZIONE CT
mkdir -p "$VF_HOST_DIR"/{models,tts/models,tts/voices,vision/models,build}
# uid 100000 = root del CT unprivileged
chown -R 100000:100000 "$VF_HOST_DIR"

NETCFG="name=eth0,bridge=$BRIDGE,firewall=1"
if [ "$IPCIDR" = "dhcp" ]; then NETCFG="$NETCFG,ip=dhcp"; else NETCFG="$NETCFG,ip=$IPCIDR,gw=$GW"; fi

log "Creo CT $CTID ($CT_HOSTNAME) su $STORAGE_CT"
pct create "$CTID" "$TPL_STORE:vztmpl/$TPL" \
  --hostname "$CT_HOSTNAME" --unprivileged 1 --features nesting=1 \
  --cores "$CORES" --memory "$MEM" --swap 2048 \
  --rootfs "$STORAGE_CT:$DISK_GB" \
  --mp0 "$VF_HOST_DIR,mp=/vf" \
  --net0 "$NETCFG" --onboot 1 --ostype debian

# ---------------------------------------------------------------- 6. GPU nel CT
if [ "$GPU" = 1 ]; then
  log "Configuro passthrough GPU nel CT (device NVIDIA)"
  CONF="/etc/pve/lxc/$CTID.conf"
  cat >> "$CONF" <<'EOF'
lxc.cgroup2.devices.allow: c 195:* rwm
lxc.cgroup2.devices.allow: c 234:* rwm
lxc.cgroup2.devices.allow: c 239:* rwm
lxc.mount.entry: /dev/nvidia0 dev/nvidia0 none bind,optional,create=file
lxc.mount.entry: /dev/nvidiactl dev/nvidiactl none bind,optional,create=file
lxc.mount.entry: /dev/nvidia-modeset dev/nvidia-modeset none bind,optional,create=file
lxc.mount.entry: /dev/nvidia-uvm dev/nvidia-uvm none bind,optional,create=file
lxc.mount.entry: /dev/nvidia-uvm-tools dev/nvidia-uvm-tools none bind,optional,create=file
lxc.mount.entry: /dev/nvidia-caps dev/nvidia-caps none bind,optional,create=dir
EOF
fi

# ---------------------------------------------------------------- 7. AVVIO + BOOTSTRAP
pct start "$CTID"
sleep 5
log "Bootstrap dentro il CT (app + servizio, SENZA modelli)"
pct exec "$CTID" -- bash -lc "apt-get update -qq && apt-get install -y -qq git curl ca-certificates"
pct exec "$CTID" -- bash -lc "git clone $REPO_URL /opt/voicefollower || (cd /opt/voicefollower && git pull --ff-only)"
pct exec "$CTID" -- bash /opt/voicefollower/install/ct-bootstrap.sh

IP_CT=$(pct exec "$CTID" -- hostname -I | awk '{print $1}')
log "FATTO. App su:  http://$IP_CT:3000"
log "Prossimo passo (dentro il CT):  pct exec $CTID -- bash /opt/voicefollower/install/download-models.sh"
if [ "$GPU" = 1 ]; then
  HOST_V=$(nvidia-smi --query-gpu=driver_version --format=csv,noheader | head -1)
  log "GPU: installo nel CT lo userland driver NVIDIA della STESSA versione dell'host ($HOST_V)"
  pct exec "$CTID" -- env NVIDIA_VERSION="$HOST_V" bash /opt/voicefollower/install/nvidia-driver-setup.sh --ct \
    || log "Userland nel CT non riuscito: rilancia  pct exec $CTID -- bash /opt/voicefollower/install/nvidia-driver-setup.sh --ct"
fi
log "Verifica finale (idempotente, rilanciabile sempre):  pct exec $CTID -- bash /opt/voicefollower/install/doctor.sh"
