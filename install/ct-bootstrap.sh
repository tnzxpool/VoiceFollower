#!/usr/bin/env bash
# ============================================================================
# ct-bootstrap.sh — Prepara il container/VM Debian 12: app VoiceFollower
# funzionante SENZA LLM e senza modelli. Idempotente, rilanciabile.
#
# Presuppone: repo già clonata in /opt/voicefollower (lo fa proxmox-install.sh;
# a mano:  git clone https://github.com/tnzxpool/VoiceFollower /opt/voicefollower)
#
# Uso (dentro il CT, come root):  bash /opt/voicefollower/install/ct-bootstrap.sh
# ============================================================================
set -euo pipefail
APP=/opt/voicefollower
log(){ echo -e "\033[1;32m[vf-boot]\033[0m $*"; }

[ -d "$APP" ] || { echo "Manca $APP: clona prima la repo."; exit 1; }

# ------------------------------------------------- 1. Pacchetti base
log "Pacchetti base"
apt-get update -qq
apt-get install -y -qq git curl ca-certificates gnupg python3 python3-venv \
  python3-pip ffmpeg build-essential

# Node 22 (nodesource) se manca o è vecchio
if ! command -v node >/dev/null || [ "$(node -v | sed 's/v//;s/\..*//')" -lt 20 ]; then
  log "Installo Node 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs
fi

# ------------------------------------------------- 2. Fix IPv6 (trappola nota)
# In LXC l'IPv6 spesso risolve ma non instrada: i download Python (HuggingFace)
# restano appesi. Curl no (happy-eyeballs), Python sì. Precedenza IPv4:
grep -q "^precedence ::ffff:0:0/96" /etc/gai.conf 2>/dev/null || \
  echo "precedence ::ffff:0:0/96  100" >> /etc/gai.conf

# ------------------------------------------------- 3. Directory dati
mkdir -p /vf/tts/models /vf/tts/voices /vf/vision/models /vf/models /vf/build
mkdir -p "$APP/data"

# ------------------------------------------------- 4. Build app
log "Build app (npm)"
cd "$APP"
npm install --no-audit --no-fund
npm run build

# .env minimo: nessun LLM richiesto. Il provider si sceglie da Admin > Config.
if [ ! -f "$APP/.env" ]; then
  cat > "$APP/.env" <<'EOF'
NODE_ENV=production
# Cervello locale (opzionale, si attiva con download-models.sh):
#LOCAL_LLM_ENDPOINT=http://127.0.0.1:9101/v1
#LOCAL_LLM_MODEL=vf-brain
#PRIMARY_PROVIDER=local_ollama
EOF
fi

# ------------------------------------------------- 5. Servizio systemd app
cat > /etc/systemd/system/voicefollower.service <<EOF
[Unit]
Description=VoiceFollower app (Express + dist) porta 3000
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$APP
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/server.cjs
Restart=on-failure
RestartSec=5s
LimitNOFILE=8192

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now voicefollower
sleep 3
systemctl is-active voicefollower && log "App ATTIVA su porta 3000"

log "Base pronta (senza LLM: la voce usa il browser, visione/cervello spenti)."
log "Modelli e funzioni GPU:  bash $APP/install/download-models.sh"
