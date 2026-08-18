# vf-tts: sintesi vocale locale con clonazione (XTTS-v2, Coqui/idiap) — porta 9107
# Voce clonata: mettere un wav di riferimento in /vf/tts/voices e passare
# speaker_wav nel POST. Senza riferimento usa una voce integrata italiana.
import os, time
os.environ.setdefault("COQUI_TOS_AGREED", "1")
os.environ.setdefault("TTS_HOME", "/vf/tts/models")
import torch
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from TTS.api import TTS

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
VOICES_DIR = "/vf/tts/voices"
DEFAULT_SPEAKER = os.environ.get("VF_TTS_SPEAKER", "Ana Florence")  # integrata XTTS

app = FastAPI()
tts = None
load_err = None


@app.on_event("startup")
def load():
    # Il primo avvio scarica il modello (~1.8GB) in TTS_HOME: puo' durare minuti.
    global tts, load_err
    try:
        tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(DEVICE)
    except Exception as e:  # servizio su, /health spiega il problema
        load_err = f"{type(e).__name__}: {e}"


class Req(BaseModel):
    text: str
    speaker_wav: str | None = None  # nome file dentro /vf/tts/voices
    speaker: str | None = None      # nome voce integrata XTTS
    language: str = "it"


@app.get("/health")
def health():
    voices = sorted(os.listdir(VOICES_DIR)) if os.path.isdir(VOICES_DIR) else []
    return {"ok": tts is not None, "error": load_err,
            "gpu": torch.cuda.is_available(),
            "device": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu",
            "model": "xtts_v2", "default_speaker": DEFAULT_SPEAKER,
            "cloned_voices": voices}


@app.post("/tts")
def synth(r: Req):
    if tts is None:
        raise HTTPException(503, f"modello non caricato: {load_err or 'startup in corso'}")
    if not r.text.strip():
        raise HTTPException(400, "testo vuoto")
    t0 = time.time()
    kw: dict = {"text": r.text.strip(), "language": r.language}
    if r.speaker_wav:
        p = os.path.join(VOICES_DIR, os.path.basename(r.speaker_wav))
        if not os.path.isfile(p):
            raise HTTPException(404, f"voce non trovata: {r.speaker_wav}")
        kw["speaker_wav"] = p
    else:
        kw["speaker"] = r.speaker or DEFAULT_SPEAKER
    out = "/tmp/vf_tts_out.wav"
    try:
        tts.tts_to_file(**kw, file_path=out)
    except Exception as e:
        raise HTTPException(500, f"sintesi fallita: {type(e).__name__}: {e}")
    with open(out, "rb") as f:
        data = f.read()
    return Response(content=data, media_type="audio/wav",
                    headers={"X-Gen-Seconds": f"{time.time() - t0:.1f}"})
