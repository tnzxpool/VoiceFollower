# vf-vision YOLO-World open-vocabulary (porta 9106) — richiede runtime NVIDIA
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04
RUN apt-get update -qq && apt-get install -y -qq python3 python3-venv python3-pip \
      libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
RUN pip3 install --no-cache-dir torch torchvision \
      --index-url https://download.pytorch.org/whl/cu118 && \
    pip3 install --no-cache-dir ultralytics fastapi uvicorn pillow python-multipart
WORKDIR /vf/vision
COPY host/vision_service.py /srv/vision_service.py
EXPOSE 9106
# i pesi YOLO + CLIP si scaricano da soli al primo avvio (lento la prima volta)
CMD ["bash", "-lc", "mkdir -p /vf/vision/models && cp -n /srv/vision_service.py /vf/vision/ 2>/dev/null; cd /vf/vision && exec python3 -m uvicorn vision_service:app --host 0.0.0.0 --port 9106"]
