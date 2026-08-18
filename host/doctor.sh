#!/usr/bin/env bash
# doctor.sh — healthcheck unico di vf-host (pattern mutuato da 740 factory)
# Uso: bash doctor.sh [host]   (default: localhost)
H=${1:-127.0.0.1}
ok(){ echo -e "  \033[1;32mOK\033[0m  $1"; }
ko(){ echo -e "  \033[1;31mKO\033[0m  $1"; }

echo "=== vf-host doctor — $H ==="

command -v nvidia-smi >/dev/null && nvidia-smi --query-gpu=name,memory.used,memory.total,temperature.gpu --format=csv,noheader || ko "nvidia-smi assente"

# vf-brain (9101) — LLM grande
curl -sf --max-time 5 "http://$H:9101/v1/models" >/dev/null && ok "vf-brain :9101 (LLM GPU)" || ko "vf-brain :9101"

# vf-prep (9102) — pre-processore
curl -sf --max-time 5 "http://127.0.0.1:9102/v1/models" >/dev/null && ok "vf-prep :9102 (pre-processore CPU)" || ko "vf-prep :9102"

# vf-stt (9103) — whisper
curl -sf --max-time 5 "http://$H:9103/" -o /dev/null && ok "vf-stt :9103 (whisper)" || ko "vf-stt :9103"

# vf-tts (9104)
T=$(curl -sf --max-time 5 "http://$H:9104/health" | jq -r .engine 2>/dev/null) && ok "vf-tts :9104 (engine: $T)" || ko "vf-tts :9104"

# vf-embed (9105)
curl -sf --max-time 5 "http://127.0.0.1:9105/v1/models" >/dev/null && ok "vf-embed :9105 (embeddings)" || ko "vf-embed :9105"

# app (3000)
curl -sf --max-time 5 "http://$H:3000/api/health" >/dev/null && ok "VoiceFollower :3000" || ko "VoiceFollower :3000"

# prova di inferenza vera sul cervello (breve)
R=$(curl -sf --max-time 60 "http://$H:9101/v1/chat/completions" -H 'Content-Type: application/json' \
  -d '{"model":"vf-brain","messages":[{"role":"user","content":"Rispondi solo: pronto"}],"max_tokens":10}' | jq -r '.choices[0].message.content' 2>/dev/null)
[ -n "$R" ] && ok "inferenza vf-brain: \"$R\"" || ko "inferenza vf-brain"
