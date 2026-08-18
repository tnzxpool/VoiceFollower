# vf-vision (porta 9106): riconoscimento oggetti su P40 (FP32).
# Due modalità:
#  - OPEN-VOCAB (default se il modello world esiste): YOLO-World v2 con il
#    vocabolario degli oggetti di casa che contano davvero per il soggetto
#    (accendino, occhiali, chiavi, portafoglio, medicine...). COCO non li ha:
#    "dove ho messo l'accendino?" era invisibile — questo è il fix (nizix 2026-08-17).
#  - COCO (fallback): YOLO11m classico, 80 classi.
# POST /detect  con multipart "image" oppure JSON {"image_b64": "..."}
# Risposta: { detections: [{label, label_it, conf, box:[x1,y1,x2,y2]}], model, mode, ms }
# GET /health  -> stato modello e GPU.
import base64, io, time, os
from fastapi import FastAPI, UploadFile, File, Body
from PIL import Image
import torch

MODEL_PATH = os.environ.get("VF_YOLO_MODEL", "/vf/vision/models/yolo11m.pt")
WORLD_PATH = os.environ.get("VF_YOLO_WORLD", "/vf/vision/models/yolov8l-worldv2.pt")
CONF_MIN = float(os.environ.get("VF_YOLO_CONF", "0.25"))

# Vocabolario aperto: prompt inglese (quello che il modello capisce) -> italiano.
# Tenuto stretto (~35 voci): con troppi prompt la precisione open-vocab cala.
VOCAB = {
    "person": "persona",
    "cigarette lighter": "accendino",
    "ashtray": "posacenere",
    "pack of cigarettes": "sigarette",
    "eyeglasses": "occhiali",
    "keys": "chiavi",
    "wallet": "portafoglio",
    "pill bottle": "medicine",
    "medicine box": "medicine",
    "remote control": "telecomando",
    "mobile phone": "telefono",
    "telephone": "telefono",
    "book": "libro",
    "newspaper": "giornale",
    "cup": "tazza",
    "drinking glass": "bicchiere",
    "bottle": "bottiglia",
    "walking cane": "bastone",
    "hearing aid": "apparecchio acustico",
    "dentures": "dentiera",
    "slippers": "pantofole",
    "shoes": "scarpe",
    "hat": "cappello",
    "wristwatch": "orologio da polso",
    "clock": "orologio",
    "scissors": "forbici",
    "umbrella": "ombrello",
    "handbag": "borsa",
    "backpack": "zaino",
    "suitcase": "valigia",
    "laptop computer": "computer portatile",
    "computer keyboard": "tastiera",
    "computer mouse": "mouse",
    "toothbrush": "spazzolino",
    "comb": "pettine",
    "hair dryer": "asciugacapelli",
    "teddy bear": "orsacchiotto",
    "tv": "televisore",
}

# Fallback COCO -> italiano (usato solo in modalità classica)
IT = {
 "person":"persona","bicycle":"bicicletta","car":"auto","motorcycle":"moto",
 "airplane":"aereo","bus":"autobus","train":"treno","truck":"camion","boat":"barca",
 "traffic light":"semaforo","fire hydrant":"idrante","stop sign":"segnale di stop",
 "parking meter":"parchimetro","bench":"panchina","bird":"uccello","cat":"gatto",
 "dog":"cane","horse":"cavallo","sheep":"pecora","cow":"mucca","elephant":"elefante",
 "bear":"orso","zebra":"zebra","giraffe":"giraffa","backpack":"zaino",
 "umbrella":"ombrello","handbag":"borsa","tie":"cravatta","suitcase":"valigia",
 "frisbee":"frisbee","skis":"sci","snowboard":"snowboard","sports ball":"palla",
 "kite":"aquilone","baseball bat":"mazza","baseball glove":"guanto da baseball",
 "skateboard":"skateboard","surfboard":"tavola da surf","tennis racket":"racchetta",
 "bottle":"bottiglia","wine glass":"bicchiere di vino","cup":"tazza",
 "fork":"forchetta","knife":"coltello","spoon":"cucchiaio","bowl":"ciotola",
 "banana":"banana","apple":"mela","sandwich":"panino","orange":"arancia",
 "broccoli":"broccoli","carrot":"carota","hot dog":"hot dog","pizza":"pizza",
 "donut":"ciambella","cake":"torta","chair":"sedia","couch":"divano",
 "potted plant":"pianta","bed":"letto","dining table":"tavolo","toilet":"water",
 "tv":"televisore","laptop":"computer portatile","mouse":"mouse",
 "remote":"telecomando","keyboard":"tastiera","cell phone":"telefono",
 "microwave":"microonde","oven":"forno","toaster":"tostapane","sink":"lavandino",
 "refrigerator":"frigorifero","book":"libro","clock":"orologio","vase":"vaso",
 "scissors":"forbici","teddy bear":"orsacchiotto","hair drier":"asciugacapelli",
 "toothbrush":"spazzolino",
}

app = FastAPI(title="vf-vision")
model = None
mode = "coco"

@app.on_event("startup")
def load_model():
    global model, mode
    if os.path.exists(WORLD_PATH):
        from ultralytics import YOLOWorld
        model = YOLOWorld(WORLD_PATH)
        model.set_classes(list(VOCAB.keys()))  # CLIP text encoder, solo all'avvio
        mode = "open-vocab"
    else:
        from ultralytics import YOLO
        model = YOLO(MODEL_PATH)
        mode = "coco"
    # warm-up: prima inferenza compila i kernel (P40 FP32)
    model.predict(Image.new("RGB", (640, 480)), verbose=False)

def run_detect(img: Image.Image):
    t0 = time.time()
    res = model.predict(img, conf=CONF_MIN, verbose=False)[0]
    dets = []
    for b in res.boxes:
        name = res.names[int(b.cls[0])]
        label_it = VOCAB.get(name) if mode == "open-vocab" else IT.get(name)
        dets.append({
            "label": name,
            "label_it": label_it or name,
            "conf": round(float(b.conf[0]), 3),
            "box": [round(float(v)) for v in b.xyxy[0].tolist()],
        })
    return {"detections": dets,
            "model": os.path.basename(WORLD_PATH if mode == "open-vocab" else MODEL_PATH),
            "mode": mode, "ms": round((time.time() - t0) * 1000)}

@app.get("/health")
def health():
    return {"ok": model is not None,
            "gpu": torch.cuda.is_available(),
            "device": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu",
            "mode": mode,
            "model": os.path.basename(WORLD_PATH if mode == "open-vocab" else MODEL_PATH)}

@app.post("/detect")
async def detect(image: UploadFile | None = File(default=None), payload: dict | None = Body(default=None)):
    if image is not None:
        img = Image.open(io.BytesIO(await image.read())).convert("RGB")
    elif payload and payload.get("image_b64"):
        b64 = payload["image_b64"].split(",")[-1]
        img = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
    else:
        return {"error": "nessuna immagine: multipart 'image' o JSON {image_b64}"}
    return run_detect(img)
