#!/usr/bin/env bash
# ============================================================
# VoiceFollower doctor — audit idempotente di versioni e stato.
# Si lancia DENTRO il CT (o sull'host Docker): solo letture, zero modifiche.
#   bash /opt/voicefollower/install/doctor.sh
# Ogni riga: [ OK ] / [FAIL] / [SKIP]. Exit code = numero di FAIL.
# ============================================================
set -uo pipefail
FAILS=0
ok(){   printf '\e[1;32m[ OK ]\e[0m %s\n' "$*"; }
fail(){ printf '\e[1;31m[FAIL]\e[0m %s\n' "$*"; FAILS=$((FAILS+1)); }
skip(){ printf '\e[1;33m[SKIP]\e[0m %s\n' "$*"; }

APP=/opt/voicefollower
echo "== VoiceFollower doctor — $(date '+%Y-%m-%d %H:%M') =="

# --- Sistema base ---
NODE_V=$(node -v 2>/dev/null | tr -d v)
[ -n "$NODE_V" ] && [ "${NODE_V%%.*}" -ge 20 ] && ok "node $NODE_V (>=20)" || fail "node assente o <20 (trovato: ${NODE_V:-nessuno})"
PY_V=$(python3 -V 2>/dev/null | awk '{print $2}')
[ -n "$PY_V" ] && ok "python3 $PY_V" || fail "python3 assente"
grep -q '::ffff:0:0/96' /etc/gai.conf 2>/dev/null \
  && ok "gai.conf: precedenza IPv4 presente (fix download HuggingFace)" \
  || fail "gai.conf: manca 'precedence ::ffff:0:0/96 100' → download Python possono appendersi"

# --- GPU ---
if [ -e /dev/nvidiactl ]; then
  CT_V=$(nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>/dev/null | head -1)
  PROC_V=$(sed -n 's/.*Module  \([0-9.]*\).*/\1/p' /proc/driver/nvidia/version 2>/dev/null | head -1)
  if [ -n "$CT_V" ]; then
    if [ -z "$PROC_V" ] || [ "$CT_V" = "$PROC_V" ]; then
      ok "GPU: userland $CT_V allineato al modulo host ${PROC_V:-?}"
    else
      fail "GPU: userland $CT_V ≠ modulo host $PROC_V → nvidia-driver-setup.sh --ct"
    fi
  else
    fail "GPU: device presenti ma nvidia-smi non funziona → userland mancante (nvidia-driver-setup.sh --ct)"
  fi
else
  skip "GPU: nessun device NVIDIA nel container (installazione CPU-only)"
fi

# --- Layout /vf ---
for d in /vf /vf/models /vf/tts /vf/vision; do
  [ -d "$d" ] && ok "dir $d" || fail "dir $d assente"
done
if [ -L /vf/models/vf-brain-current.gguf ]; then
  TGT=$(readlink -f /vf/models/vf-brain-current.gguf)
  [ -f "$TGT" ] && ok "orchestratore attivo: $(basename "$TGT")" || fail "symlink vf-brain-current.gguf rotto → $TGT"
else
  skip "orchestratore: symlink vf-brain-current.gguf assente (cervello locale non attivato)"
fi

# --- Venv: versioni collaudate (P40 → cu118, transformers<5) ---
check_venv(){ # $1 venv  $2 nome
  local PIP="$1/bin/pip"
  [ -x "$PIP" ] || { skip "$2: venv assente"; return; }
  local TORCH=$("$PIP" show torch 2>/dev/null | awk '/^Version/{print $2}')
  if [ -n "$TORCH" ]; then
    case "$TORCH" in *cu118*|*+cu118*) ok "$2: torch $TORCH (cu118 — ok Pascal)";;
      *) [ -e /dev/nvidiactl ] && fail "$2: torch $TORCH senza cu118 su macchina GPU Pascal" || ok "$2: torch $TORCH (CPU)";; esac
  else skip "$2: torch non installato nel venv"; fi
  if [ "$2" = "vf-tts" ]; then
    local TF=$("$PIP" show transformers 2>/dev/null | awk '/^Version/{print $2}')
    if [ -n "$TF" ]; then
      case "$TF" in 4.*) ok "vf-tts: transformers $TF (<5, pin rispettato)";; *) fail "vf-tts: transformers $TF — incompatibile con coqui-tts, serve >=4.54,<5";; esac
    fi
  fi
}
check_venv /vf/tts/venv vf-tts
check_venv /vf/vision/venv vf-vision

# --- Servizi ---
for s in voicefollower vf-brain vf-tts vf-vision vf-prep vf-embed; do
  if systemctl list-unit-files "$s.service" --no-legend 2>/dev/null | grep -q "$s"; then
    systemctl is-active --quiet "$s" && ok "servizio $s attivo" || fail "servizio $s installato ma NON attivo"
  else
    case "$s" in voicefollower) fail "servizio $s non installato";; *) skip "servizio $s non installato (funzione non attivata)";; esac
  fi
done

# --- Endpoint di salute ---
check_http(){ # $1 url  $2 nome
  local CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "$1" 2>/dev/null)
  [ "$CODE" = 200 ] && ok "$2 risponde ($1)" || { systemctl is-active --quiet "${2}" 2>/dev/null && fail "$2 attivo ma $1 → HTTP ${CODE:-timeout}" || skip "$2 non risponde ($1) — servizio spento"; }
}
check_http http://127.0.0.1:3000/api/health voicefollower
check_http http://127.0.0.1:9101/health vf-brain
check_http http://127.0.0.1:9106/health vf-vision
check_http http://127.0.0.1:9107/health vf-tts

# --- Repo vs origin ---
if [ -d "$APP/.git" ]; then
  cd "$APP"
  LOC=$(git rev-parse --short HEAD 2>/dev/null)
  git fetch -q origin main 2>/dev/null || true
  REM=$(git rev-parse --short origin/main 2>/dev/null)
  if [ -n "$REM" ]; then
    [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] \
      && ok "repo: $LOC allineato a origin/main" \
      || fail "repo: HEAD $LOC ≠ origin/main $REM → aggiornare (git pull + npm run build + restart)"
  else
    skip "repo: origin non raggiungibile (offline?) — HEAD locale $LOC"
  fi
  [ -f "$APP/dist/server.cjs" ] && ok "build presente (dist/server.cjs)" || fail "build assente: npm run build"
else
  fail "repo $APP assente"
fi

echo "== Esito: $FAILS problemi =="
exit "$FAILS"
