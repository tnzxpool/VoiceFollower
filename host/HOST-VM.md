# Host VM — "vf-host": il cervello locale di VoiceFollower

> Decisione (2026-08-16): la 740 Factory live viene **spenta**. La P40 passa alla
> nuova VM. Tutto gira **in locale sulla LAN**, niente uscita su internet, porte
> **diverse** da quelle della factory (8080/8081/8448/11434 restano libere e
> riconoscibili come "sue").

## Brainstorm — le idee che guidano il progetto

**1. La latenza percepita è il prodotto.** Per un paziente Alzheimer una pausa di
8 secondi è una conversazione morta. Soluzione a **due stadi**: un modello piccolo
(CPU) genera subito una battuta di contatto ("Sì, ti ascolto…") pronunciata dal TTS
mentre il modello grande (GPU) elabora la risposta vera. Latenza percepita < 1s.

**2. Il pre-processore è l'orecchio intelligente.** Prima dell'orchestratore, un
modello piccolo trasforma il transcript grezzo in un pacchetto strutturato:
- intento (richiesta / disorientamento / emergenza / chiacchiera)
- urgenza e stato emotivo stimato
- normalizzazione dialetti: lookup nel DB DialectToken ("nàna" → "dormire")
- entità e riferimenti a memorie biografiche (via embeddings sul grafo)
Il modello grande riceve un prompt corto e denso invece di un transcript sporco:
più preciso E più veloce (meno token).

**3. La VRAM non si spreca in swap.** Un solo modello grande, **sempre residente**
(mlock, mai unload), KV-cache quantizzata. Tutto ciò che sta bene su CPU sta su
CPU: i due Xeon del R740 sono sottoutilizzati da sempre.

**4. La memoria è persistente o non è memoria.** Oggi dialetti/grafo/biografia
vivono in RAM del server Node: si perdono a ogni riavvio. Si passa a SQLite reale
+ embeddings per il retrieval. Job notturno di **consolidamento**: il modello
grande rilegge i transcript del giorno e aggiorna grafo e dialetti (apprendimento
complesso, quando la GPU è scarica).

**5. La voce "basica" si cura con modelli veri.** Web Speech API → dismessa come
via primaria. STT: whisper.cpp large-v3-turbo su GPU (italiano eccellente, ~1.6GB).
TTS: Kokoro (voci italiane, qualità alta, leggero) come primario; Piper come
fallback istantaneo CPU. Passo successivo possibile: XTTS-v2 per clonare una voce
familiare al paziente (fortissimo per l'ancoraggio emotivo — da valutare con la
famiglia).

**6. Dalla factory si mutuano i costrutti, non il deployment:**
- catalogo modelli a manifest (`model-manifests/catalog.json`) con provenance
- unit systemd per-modello renderizzate da template (`r740-model.service.in`)
- `doctor.sh`: healthcheck unico che interroga tutti i servizi
- secrets su file (`admin_token`), mai in env/repo
- `runtime.env` come unico punto di configurazione

## Budget VRAM — Tesla P40, 24 GB

| Residente in VRAM              | Stima    |
|--------------------------------|----------|
| Cervello: Qwen3.6-35B-A3B IQ4_XS (MoE, ~3B attivi → veloce) | ~18 GB |
| KV cache (q8, ctx 8k)          | ~1.5 GB  |
| Whisper large-v3-turbo (q5)    | ~1.6 GB  |
| Margine                        | ~2.5 GB  |

Su CPU (Xeon): pre-processore (Qwen 1.7B–4B Q4), TTS Kokoro/Piper, embeddings
(bge-m3 / e5-small), SQLite, grafo, app Node.

**I pesi GGUF non si riscaricano**: si copiano dal disco della VM factory prima
di spegnerla (`rsync` dei .gguf).

## Mappa porte (tutte solo LAN, bind 0.0.0.0 su rete locale, zero WAN)

| Porta | Servizio       | Unit systemd  | Runtime            |
|-------|----------------|---------------|--------------------|
| 9101  | vf-brain       | vf-brain      | llama-server CUDA  |
| 9102  | vf-prep        | vf-prep       | llama-server CPU   |
| 9103  | vf-stt         | vf-stt        | whisper-server CUDA|
| 9104  | vf-tts         | vf-tts        | Kokoro/Piper HTTP  |
| 9105  | vf-embed       | vf-embed      | llama-server --embedding CPU |
| 3000  | VoiceFollower  | voicefollower | Node/tsx           |

Tutti i servizi 9101–9105 espongono API OpenAI-compatibili o HTTP semplici: l'app
li raggiunge con il campo endpoint già esistente (`http://127.0.0.1:9101/v1`,
nessuna credenziale → ramo OpenAI-compatibile liscio, niente login portale).

## Flusso a regime

```
mic (.4 kiosk / slave) ──▶ vf-stt (9103) ──▶ transcript
transcript ──▶ vf-prep (9102): intento+dialetti+memorie ─┬─▶ battuta rapida ──▶ vf-tts ──▶ speaker
                                                          └─▶ pacchetto strutturato
pacchetto + contesto grafo (vf-embed 9105 + SQLite) ──▶ vf-brain (9101) ──▶ risposta
risposta ──▶ vf-tts (9104) ──▶ speaker  +  aggiornamenti grafo/dialetti ──▶ SQLite
notte ──▶ job consolidamento: vf-brain rilegge il giorno ──▶ grafo/dialetti aggiornati
```

## Sequenza operativa

1. **Prima di spegnere la factory**: copiare i .gguf dal suo disco (vedi
   `provision_host.sh`, sezione MODELLI).
2. Spegnere la factory da Proxmox (`ssh root@192.168.1.88`):
   `qm list` per trovare l'ID, poi `qm stop <ID>` e `qm set <ID> --onboot 0`
   (reversibile: `qm start <ID>`). Togliere il passthrough della P40 dalla sua
   config e assegnarlo alla nuova VM.
3. Creare la VM `vf-host` (Ubuntu Server 24.04, 8 vCPU, 32 GB RAM, 100 GB disco,
   passthrough P40, IP statico consigliato: **192.168.1.89**).
4. Sulla VM: `bash provision_host.sh` (idempotente, riprende da dove si ferma).
5. `bash doctor.sh` → tutti verdi.
6. Sul PC .4: doppio click su `KIOSK_4.bat` (già puntato a 192.168.1.89).

## Cosa cambia nell'app (fasi successive, in ordine)

1. Persistenza SQLite di dialetti/grafo/biografia (via `better-sqlite3`).
2. Endpoint `/api/stt` e `/api/tts` proxati su 9103/9104 (via Web Speech solo fallback).
3. Pipeline pre-processore + battuta rapida in `/api/orchestrate`.
4. Job notturno di consolidamento.
