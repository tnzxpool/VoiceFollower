#!/usr/bin/env bash
# ============================================================================
# download-models.sh — Procedura GUIDATA per installare i modelli e accendere
# le funzioni GPU di VoiceFollower, una per una. Rilanciabile: salta il già fatto.
#
# La lista dei modelli è install/models.json (aggiornabile dall'admin:
# modifica il file — nuovi nomi/URL — e rilancia questo wizard).
#
# Uso (dentro il CT, come root):  bash /opt/voicefollower/install/download-models.sh
# ============================================================================
set -euo pipefail
APP=/opt/voicefollower
MJ="$APP/install/models.json"
TORCH_INDEX=https://download.pytorch.org/whl/cu118   # cu118 = ok per P40 (Pascal sm_61)

log(){ echo -e "\033[1;32m[vf-models]\033[0m $*"; }
warn(){ echo -e "\033[1;33m[attenzione]\033[0m $*"; }
jval(){ python3 -c "import json,sys;d=json.load(open('$MJ'));print(d['$1'].get('$2',''))"; }

GPU=0
command -v nvidia-smi >/dev/null && nvidia-smi -L >/dev/null 2>&1 && GPU=1
[ "$GPU" = 1 ] && log "GPU: $(nvidia-smi -L | head -1)" || warn "Nessuna GPU visibile nel CT: installazioni in modalità CPU (lente). Vedi INSTALL.md §GPU."

install_tts(){
  log "=== VOCE (XTTS-v2, porta 9107) ==="
  mkdir -p /vf/tts/models /vf/tts/voices
  cp -f "$APP/host/tts_service.py" /vf/tts/tts_service.py
  cd /vf/tts
  [ -d venv ] || python3 -m venv venv
  venv/bin/pip install -q --upgrade pip
  if [ "$GPU" = 1 ]; then
    venv/bin/pip install -q "torch==2.7.1+cu118" "torchaudio==2.7.1+cu118" --index-url $TORCH_INDEX
  else
    venv/bin/pip install -q torch torchaudio
  fi
  # coqui-tts 0.27 rompe con transformers 5.x: pin obbligatorio
  venv/bin/pip install -q coqui-tts "transformers>=4.54,<5" fastapi uvicorn
  cat > /etc/systemd/system/vf-tts.service <<'EOF'
[Unit]
Description=vf-tts XTTS-v2 clonazione voce (porta 9107)
After=network.target

[Service]
WorkingDirectory=/vf/tts
Environment=COQUI_TOS_AGREED=1
Environment=TTS_HOME=/vf/tts/models
ExecStart=/vf/tts/venv/bin/uvicorn tts_service:app --host 0.0.0.0 --port 9107
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload && systemctl enable --now vf-tts
  log "Primo avvio: scarica XTTS-v2 (~1.9 GB) in /vf/tts/models — può volerci qualche minuto."
  log "Verifica:  curl http://127.0.0.1:9107/health"
  log "Voce clonata: metti un wav del caregiver in /vf/tts/voices/ (o registra dal pannello Admin)."
}

install_vision(){
  log "=== VISIONE (YOLO-World, porta 9106) ==="
  mkdir -p /vf/vision/models
  cp -f "$APP/host/vision_service.py" /vf/vision/vision_service.py
  cd /vf/vision
  [ -d venv ] || python3 -m venv venv
  venv/bin/pip install -q --upgrade pip
  if [ "$GPU" = 1 ]; then
    venv/bin/pip install -q torch torchvision --index-url $TORCH_INDEX
  else
    venv/bin/pip install -q torch torchvision
  fi
  venv/bin/pip install -q ultralytics fastapi uvicorn pillow python-multipart
  cat > /etc/systemd/system/vf-vision.service <<'EOF'
[Unit]
Description=vf-vision YOLO-World open-vocabulary (porta 9106)
After=network.target

[Service]
WorkingDirectory=/vf/vision
ExecStart=/vf/vision/venv/bin/uvicorn vision_service:app --host 0.0.0.0 --port 9106
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload && systemctl enable --now vf-vision
  log "Primo avvio: scarica i pesi YOLO + CLIP da solo (avvio lento la prima volta: normale)."
  log "Verifica:  curl http://127.0.0.1:9106/health"
}

install_brain(){
  log "=== CERVELLO LOCALE (llama.cpp + GGUF, porta 9101) ==="
  local FILE URL
  FILE=$(jval cervello_locale modello)
  URL=$(jval cervello_locale url)
  if [ ! -x /vf/build/llama.cpp/build/bin/llama-server ]; then
    log "Compilo llama.cpp (CUDA per Pascal: FORCE_MMQ)"
    apt-get install -y -qq cmake build-essential git
    [ -d /vf/build/llama.cpp ] || git clone --depth 1 https://github.com/ggml-org/llama.cpp /vf/build/llama.cpp
    if [ "$GPU" = 1 ]; then
      cmake -S /vf/build/llama.cpp -B /vf/build/llama.cpp/build -DGGML_CUDA=ON -DGGML_CUDA_FORCE_MMQ=ON -DCMAKE_BUILD_TYPE=Release
    else
      cmake -S /vf/build/llama.cpp -B /vf/build/llama.cpp/build -DCMAKE_BUILD_TYPE=Release
    fi
    cmake --build /vf/build/llama.cpp/build -j"$(nproc)" --target llama-server
  fi
  if [ ! -f "/vf/models/$FILE" ]; then
    if [ -n "$URL" ]; then
      log "Scarico $FILE"
      curl -L --fail -o "/vf/models/$FILE" "$URL"
    else
      warn "Manca /vf/models/$FILE e 'url' in models.json è vuoto."
      warn "Compila l'url (HuggingFace → file .gguf → Copy download link) e rilancia,"
      warn "oppure copia il file da una macchina esistente:  scp <sorgente> /vf/models/"
      return 1
    fi
  fi
  # Convenzione orchestratore: la unit legge SEMPRE il symlink vf-brain-current.gguf.
  # Cambiare modello = ricreare il symlink (dall'admin o a mano) + restart, la unit non si tocca.
  ln -sfn "/vf/models/$FILE" /vf/models/vf-brain-current.gguf
  cat > /etc/systemd/system/vf-brain.service <<EOF
[Unit]
Description=VoiceFollower brain — orchestratore locale (llama.cpp, symlink vf-brain-current.gguf)
After=network.target

[Service]
Environment=LD_LIBRARY_PATH=/vf/build/llama.cpp/build/bin
ExecStart=/vf/build/llama.cpp/build/bin/llama-server \\
  -m /vf/models/vf-brain-current.gguf \\
  --alias vf-brain --jinja -ngl 99 --ctx-size 8192 --parallel 2 \\
  --temp 1.0 --top-p 0.95 --top-k 20 --min-p 0 \\
  --reasoning-budget 0 --cache-reuse 256 --host 0.0.0.0 --port 9101
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload && systemctl enable --now vf-brain
  # collega l'app al cervello locale
  grep -q "^LOCAL_LLM_ENDPOINT=" "$APP/.env" 2>/dev/null || cat >> "$APP/.env" <<'EOF'
LOCAL_LLM_ENDPOINT=http://127.0.0.1:9101/v1
LOCAL_LLM_MODEL=vf-brain
PRIMARY_PROVIDER=local_ollama
EOF
  systemctl restart voicefollower
  log "Verifica:  curl http://127.0.0.1:9101/health"
}

echo
echo "VoiceFollower — installazione guidata modelli (lista: install/models.json)"
echo "  1) Voce clonata XTTS-v2        (~1.9 GB, auto-download)"
echo "  2) Visione YOLO-World          (~450 MB, auto-download)"
echo "  3) Cervello locale llama.cpp   (GGUF grande: serve url in models.json o copia manuale)"
echo "  4) Tutto (1+2+3)"
echo "  0) Esci"
read -rp "Scelta: " CH
case "$CH" in
  1) install_tts ;;
  2) install_vision ;;
  3) install_brain ;;
  4) install_tts; install_vision; install_brain || true ;;
  *) exit 0 ;;
esac
log "Fatto. Stato servizi:"; systemctl --no-pager | grep -E "vf-|voicefollower" || true
