# vf-tts XTTS-v2 (porta 9107) — richiede runtime NVIDIA (cu118: ok anche P40/Pascal)
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04
RUN apt-get update -qq && apt-get install -y -qq python3 python3-venv python3-pip && \
    rm -rf /var/lib/apt/lists/*
RUN pip3 install --no-cache-dir "torch==2.7.1+cu118" "torchaudio==2.7.1+cu118" \
      --index-url https://download.pytorch.org/whl/cu118 && \
    pip3 install --no-cache-dir coqui-tts "transformers>=4.54,<5" fastapi uvicorn
WORKDIR /vf/tts
COPY host/tts_service.py /srv/tts_service.py
ENV COQUI_TOS_AGREED=1 TTS_HOME=/vf/tts/models
EXPOSE 9107
# il modello (~1.9 GB) si scarica da solo al primo avvio in /vf/tts/models
CMD ["bash", "-lc", "mkdir -p /vf/tts/models /vf/tts/voices && cp -n /srv/tts_service.py /vf/tts/ 2>/dev/null; cd /vf/tts && exec python3 -m uvicorn tts_service:app --host 0.0.0.0 --port 9107"]
