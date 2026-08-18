#!/usr/bin/env bash
# ============================================================================
# provision_host.sh — VM "vf-host" (Ubuntu Server 24.04, P40 passthrough)
# Idempotente: rilanciabile, salta cio' che e' gia' fatto.
# Uso:  sudo bash provision_host.sh
# ============================================================================
set -euo pipefail

# ---------------------------- CONFIG ----------------------------------------
VF_ROOT=/opt/voicefollower
MODELS_DIR=$VF_ROOT/models
SRC_DIR=$VF_ROOT/src
DATA_DIR=/var/lib/voicefollower          # SQLite, grafo, log apprendimento
SECRETS_DIR=/etc/voicefollower/secrets   # stile factory: secrets su file

# Porte (NON quelle della factory: 8080/8081/8448/11434 restano libere)
PORT_BRAIN=9101
PORT_PREP=9102
PORT_STT=9103
PORT_TTS=9104
PORT_EMBED=9105
PORT_APP=3000

# Modelli (nomi file attesi in $MODELS_DIR — vedi sezione MODELLI sotto)
BRAIN_GGUF=$MODELS_DIR/qwen3.6-35b-a3b-iq4xs.gguf
PREP_GGUF=$MODELS_DIR/qwen3-1.7b-q4.gguf
EMBED_GGUF=$MODELS_DIR/bge-m3-q8.gguf
WHISPER_BIN_MODEL=$MODELS_DIR/ggml-large-v3-turbo-q5_0.bin

REPO_URL=https://github.com/tnzxpool/VoiceFollower

log(){ echo -e "\033[1;32m[vf-host]\033[0m $*"; }

# ---------------------------- 1. PACCHETTI BASE -----------------------------
log "Pacchetti base"
apt-get update -qq
apt-get install -y -qq build-essential cmake git curl jq rsync \
  python3 python3-venv python3-pip sqlite3 espeak-ng ffmpeg

# Node 22 (per l'app)
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi

# ---------------------------- 2. DRIVER NVIDIA + CUDA -----------------------
if ! command -v nvidia-smi >/dev/null; then
  log "Driver NVIDIA (P40 = ok con il ramo 535 server)"
  apt-get install -y -qq nvidia-driver-535-server nvidia-cuda-toolkit
  log ">>> RIAVVIA la VM e rilancia questo script <<<"; exit 0
fi
nvidia-smi -L

# ---------------------------- 3. DIRECTORY ----------------------------------
mkdir -p "$MODELS_DIR" "$DATA_DIR" "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"
[ -f "$SECRETS_DIR/admin_token" ] || { head -c 32 /dev/urandom | sha256sum | cut -d' ' -f1 > "$SECRETS_DIR/admin_token"; chmod 600 "$SECRETS_DIR/admin_token"; }

# ---------------------------- 4. MODELLI ------------------------------------
# I .gguf del cervello sono GIA' sul disco della VM factory: copiali PRIMA di
# spegnerla (adatta utente/percorso — cerca con: find / -name '*.gguf' 2>/dev/null):
#   rsync -avP root@192.168.1.88:/percorso/dei/modelli/*.gguf /opt/voicefollower/models/
if [ ! -f "$BRAIN_GGUF" ]; then
  log "ATTENZIONE: manca $BRAIN_GGUF — copialo dalla VM factory (vedi commento sopra)."
fi

# ---------------------------- 5. LLAMA.CPP (CUDA) ---------------------------
if [ ! -x /usr/local/bin/llama-server ]; then
  log "Compilo llama.cpp con CUDA (P40: FORCE_MMQ per Pascal)"
  git clone --depth 1 https://github.com/ggml-org/llama.cpp /tmp/llama.cpp
  cmake -S /tmp/llama.cpp -B /tmp/llama.cpp/build \
    -DGGML_CUDA=ON -DGGML_CUDA_FORCE_MMQ=ON -DCMAKE_BUILD_TYPE=Release
  cmake --build /tmp/llama.cpp/build -j"$(nproc)" --target llama-server
  install -m755 /tmp/llama.cpp/build/bin/llama-server /usr/local/bin/llama-server
fi

# ---------------------------- 6. WHISPER.CPP (CUDA) -------------------------
if [ ! -x /usr/local/bin/whisper-server ]; then
  log "Compilo whisper.cpp con CUDA"
  git clone --depth 1 https://github.com/ggml-org/whisper.cpp /tmp/whisper.cpp
  cmake -S /tmp/whisper.cpp -B /tmp/whisper.cpp/build -DGGML_CUDA=ON -DCMAKE_BUILD_TYPE=Release
  cmake --build /tmp/whisper.cpp/build -j"$(nproc)"
  install -m755 /tmp/whisper.cpp/build/bin/whisper-server /usr/local/bin/whisper-server
  [ -f "$WHISPER_BIN_MODEL" ] || bash /tmp/whisper.cpp/models/download-ggml-model.sh large-v3-turbo-q5_0 "$MODELS_DIR"
fi

# ---------------------------- 7. TTS ----------------------------------------
# Primario: Kokoro (voci italiane, qualita' alta). Fallback: Piper.
if [ ! -d "$VF_ROOT/tts-venv" ]; then
  log "Installo TTS (Kokoro + Piper)"
  python3 -m venv "$VF_ROOT/tts-venv"
  "$VF_ROOT/tts-venv/bin/pip" -q install kokoro soundfile flask piper-tts || \
    "$VF_ROOT/tts-venv/bin/pip" -q install piper-tts flask soundfile
fi
cat > "$VF_ROOT/tts_server.py" <<'PYEOF'
"""vf-tts: HTTP TTS su :9104. POST /tts {"text","voice"} -> audio/wav.
Kokoro se disponibile, altrimenti Piper, altrimenti espeak-ng (emergenza)."""
import io, subprocess, os
from flask import Flask, request, send_file
app = Flask(__name__)
ENGINE = "espeak"
try:
    from kokoro import KPipeline
    import soundfile as sf
    import numpy as np
    pipe = KPipeline(lang_code="i")  # italiano
    ENGINE = "kokoro"
except Exception:
    pass

@app.post("/tts")
def tts():
    j = request.get_json(force=True)
    text = j.get("text", "")
    voice = j.get("voice", "if_sara")
    if ENGINE == "kokoro":
        chunks = [audio for _, _, audio in pipe(text, voice=voice)]
        buf = io.BytesIO()
        sf.write(buf, np.concatenate(chunks), 24000, format="WAV")
        buf.seek(0)
        return send_file(buf, mimetype="audio/wav")
    out = "/tmp/vf_tts.wav"
    subprocess.run(["espeak-ng", "-v", "it", "-w", out, text], check=True)
    return send_file(out, mimetype="audio/wav")

@app.get("/health")
def health():
    return {"status": "ok", "engine": ENGINE}

app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 9104)))
PYEOF

# ---------------------------- 8. APP VOICEFOLLOWER --------------------------
if [ ! -d "$SRC_DIR/.git" ]; then
  git clone "$REPO_URL" "$SRC_DIR"
fi
cd "$SRC_DIR" && git pull --ff-only && npm install --no-audit --no-fund && npm run build
cat > "$SRC_DIR/.env" <<ENVEOF
LOCAL_LLM_ENDPOINT=http://127.0.0.1:$PORT_BRAIN/v1
LOCAL_LLM_MODEL=vf-brain
VF_PREP_ENDPOINT=http://127.0.0.1:$PORT_PREP/v1
VF_STT_ENDPOINT=http://127.0.0.1:$PORT_STT
VF_TTS_ENDPOINT=http://127.0.0.1:$PORT_TTS
VF_EMBED_ENDPOINT=http://127.0.0.1:$PORT_EMBED/v1
VF_DATA_DIR=$DATA_DIR
ENVEOF

# ---------------------------- 9. UNIT SYSTEMD -------------------------------
log "Unit systemd (pattern factory: una unit per servizio)"
unit(){ # $1 nome  $2 descrizione  $3 ExecStart  [$4 extra]
cat > "/etc/systemd/system/$1.service" <<UEOF
[Unit]
Description=$2
After=network.target

[Service]
ExecStart=$3
Restart=always
RestartSec=5
${4:-}

[Install]
WantedBy=multi-user.target
UEOF
}

unit vf-brain "VF Brain — LLM grande residente in VRAM (P40)" \
  "/usr/local/bin/llama-server -m $BRAIN_GGUF --alias vf-brain -ngl 99 --mlock -c 8192 -ct q8_0 --parallel 2 --host 0.0.0.0 --port $PORT_BRAIN"

unit vf-prep "VF Prep — pre-processore CPU (intenti, dialetti, battuta rapida)" \
  "/usr/local/bin/llama-server -m $PREP_GGUF --alias vf-prep -ngl 0 -c 4096 --parallel 4 --host 127.0.0.1 --port $PORT_PREP"

unit vf-stt "VF STT — whisper large-v3-turbo (GPU)" \
  "/usr/local/bin/whisper-server -m $WHISPER_BIN_MODEL -l it --host 0.0.0.0 --port $PORT_STT"

unit vf-tts "VF TTS — Kokoro/Piper" \
  "$VF_ROOT/tts-venv/bin/python $VF_ROOT/tts_server.py" "Environment=PORT=$PORT_TTS"

unit vf-embed "VF Embed — embeddings CPU per grafo/memorie" \
  "/usr/local/bin/llama-server -m $EMBED_GGUF --embedding -ngl 0 --host 127.0.0.1 --port $PORT_EMBED"

unit voicefollower "VoiceFollower Master (Node)" \
  "/usr/bin/npx tsx server.ts" "WorkingDirectory=$SRC_DIR
Environment=NODE_ENV=production"

systemctl daemon-reload
for s in vf-brain vf-prep vf-stt vf-tts vf-embed voicefollower; do
  systemctl enable "$s" >/dev/null 2>&1 || true
  systemctl restart "$s" || log "NB: $s non parte (probabile modello mancante) — vedi journalctl -u $s"
done

log "Fatto. Verifica con: bash $(dirname "$0")/doctor.sh"
