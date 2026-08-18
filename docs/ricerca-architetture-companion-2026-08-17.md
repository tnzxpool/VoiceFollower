# Ricerca: architetture per companion vocali realistici (2026-08-17)

Richiesta di nizix: senza reinventare la ruota, studiare come i sistemi di
compagnia commerciali (anche i siti di "fidanzate virtuali" con voci realistiche)
ottengono realismo e bassa latenza, e cosa possiamo riusare in VoiceFollower.

## (a) Come fanno i migliori

Due famiglie di architetture. **Cascata streaming** (ElevenLabs Conversational,
Vapi, Character.ai): STT streaming → LLM streaming → TTS streaming, tutto su
WebSocket bidirezionali; il TTS parte appena arriva la prima frase del LLM e
l'audio esce in chunk. Metrica chiave: **TTFA (time-to-first-audio)** —
ElevenLabs dichiara ~120 ms p90, Hume ~150-300 ms. **Speech-to-speech
end-to-end** (Moshi, Hume EVI 3, in parte Sesame): un solo modello genera
token testo+voce insieme, full-duplex nativo, <500 ms — ma richiede GPU moderne
e non è controllabile come una cascata.

Il realismo percepito viene meno dal modello e più da:
- **endpointing semantico**: un classificatore decide se l'utente ha finito dal
  contenuto, non da un timeout di silenzio fisso — ridurre il timeout di 200 ms
  conta più di un modello più veloce;
- **barge-in**: stop immediato del TTS quando il VAD sente voce;
- **filler** ("mmh, vediamo…") per mascherare la latenza del LLM.

## (b) Componenti open-source per il nostro stack (voce italiana maschile, P40/CPU)

**Vincolo P40**: FP16 castrato (1/64 di FP32), niente tensor core → tutto in
FP32 o quantizzato int8/GGUF/ONNX.

- **STT**: `faster-whisper` (CTranslate2, int8, ok su Pascal e CPU) dentro
  **RealtimeSTT** (KoljaB, MIT): VAD Silero, endpointing, trascrizione live.
  Italiano ottimo con `small`/`medium`. Alternativa: `whisper.cpp --stream`.
- **TTS italiano maschile**, in ordine:
  1. **Chatterbox Multilingual (Resemble AI)** — MIT, italiano incluso, voice
     cloning da pochi secondi di audio, <200 ms dichiarati (Turbo 350M ~75 ms).
     Candidato migliore. DA PROVARE su P40 in FP32 (rischio lentezza: prova n.1).
  2. **Piper** `it_IT-riccardo` (x_low, qualità modesta) — MIT, realtime su CPU,
     zero rischio. Rete di sicurezza; possibile voce custom addestrata
     (precedente italiano: kirys.it).
  3. **Kokoro-82M** voce `im_nicola` — Apache 2.0, leggerissimo (ONNX su CPU),
     ma bug noto di fonetica italiana "anglicizzata" ("inoltre" → "inoltchre").
     Ascoltare prima di scegliere.
  4. **XTTS-v2** — italiano buono, cloning, streaming, ~5-6 GB VRAM, ma licenza
     CPML non commerciale e progetto morto. **F5-TTS italiano**
     (`alien79/F5-TTS-italian`) — qualità alta ma pesante, non da streaming.
- **Orchestrazione**: **RealtimeVoiceChat** (KoljaB) è la reference quasi 1:1
  del nostro caso: mic browser → WebSocket → RealtimeSTT → LLM locale streaming
  → RealtimeTTS con `stream2sentence` → audio a chunk nel browser, barge-in
  incluso. Più strutturati: **Pipecat** o **LiveKit Agents** (WebRTC).
- **Ducking**: GainNode Web Audio (duck a ~-12 dB, attack ~0.3 s, release ~1 s).
  Musica dallo STESSO dispositivo/pagina: l'AEC del browser la cancella dal
  microfono; cassa separata = eco. → Tenere musica e voce sulla stessa uscita.
  (Implementato il 2026-08-17 in KioskVoiceCompanion.)

## (c) Tre architetture per VoiceFollower, per sforzo crescente

1. **Sentence-streaming sul sistema attuale** (sforzo basso, beneficio alto).
   Tenere Edge kiosk e Web Speech STT; il server manda i token del LLM via
   WebSocket, spezza alla prima frase, sintetizza frase-per-frase con
   Piper/Kokoro locale, il browser accoda i chunk (+ GainNode per ducking).
   Latenza percepita: da 3-9 s a ~1-1.5 s senza toccare STT né LLM.
2. **Stack KoljaB** (sforzo medio, beneficio massimo/costo). RealtimeSTT
   (faster-whisper int8) al posto di Web Speech, RealtimeTTS + Chatterbox
   (Piper fallback): barge-in, endpointing rapido, voce controllata offline.
   RealtimeVoiceChat come progetto-guida.
3. **Pipecat/LiveKit self-hosted** (sforzo alto). WebRTC, turn-detection
   semantico, filler automatici. Ha senso con più dispositivi/stanze o telefonia.

## Nota demenza/Alzheimer

Letteratura recente su companion vocali per ADRD con validation therapy e
simulated presence (KindredMind; RCT 2025 su Int. J. Neuroscience: riduzione di
agitazione/ansia con "voce familiare"). Indicazione pratica: base biografica
della persona + stile validante nel prompt, e valutare il **voice cloning di
una voce familiare** (Chatterbox/XTTS, da pochi secondi di audio, col consenso).

## Fonti

- https://www.spheron.network/blog/speech-to-speech-gpu-cloud-moshi-sesame-csm-hertz-dev/
- https://www.hume.ai/blog/introducing-evi-3
- https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization
- https://github.com/KoljaB/RealtimeVoiceChat · RealtimeTTS · RealtimeSTT · stream2sentence
- https://github.com/resemble-ai/chatterbox · https://www.resemble.ai/learn/models/chatterbox-multilingual
- https://github.com/rhasspy/piper/blob/master/VOICES.md · https://kirys.it/blog_it/2024/una_voce_italiana_per_piper.html
- https://github.com/nazdridoy/kokoro-tts/issues/54 (fonetica italiana Kokoro)
- https://huggingface.co/coqui/XTTS-v2 · https://huggingface.co/alien79/F5-TTS-italian
- https://github.com/k2-fsa/sherpa-onnx
- https://soniox.com/wiki/endpoint-detection · https://livekit.com/blog/turn-detection-voice-agents-vad-endpointing-model-based-detection
- https://www.evalgent.com/blog/pipecat-vs-livekit
- https://localaimaster.com/blog/tesla-p40-local-llm (limiti FP16 Pascal)
- https://kindredmind.care/ai-companion-for-dementia · https://aclanthology.org/2026.sigdial-1.5/
