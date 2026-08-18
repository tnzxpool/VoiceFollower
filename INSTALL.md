# VoiceFollower — Manuale di installazione

Come ricreare **tutto l'ambiente da zero** su una macchina nuova che ha solo
**Proxmox** (via A) oppure solo **Docker** (via B). La configurazione base
funziona **senza alcun LLM e senza modelli**: si installa in pochi minuti, poi
una **procedura guidata** scarica i modelli per le singole funzioni.

## Architettura (cosa viene installato)

| Servizio | Porta | Funzione | Richiede |
|---|---|---|---|
| voicefollower (app) | 3000 | Kiosk, admin, API, sorveglianza | niente |
| vf-tts | 9107 | Voce clonata XTTS-v2 (zero-shot) | GPU consigliata |
| vf-vision | 9106 | Oggetti di casa (YOLO-World open-vocab) | GPU consigliata |
| vf-brain | 9101 | LLM locale offline (llama.cpp + GGUF) | GPU + ~15 GB |
| vf-prep / vf-embed | 9102 / 9105 | Preprocessore e embeddings (opzionali) | CPU |

Tutti i dati e i modelli vivono in **`/vf`** (bind mount da una cartella
dell'host, così sopravvivono al container). I dati personali del paziente
stanno in `data/` dell'app e **non vanno mai su GitHub** (già in .gitignore).

**Senza modelli l'app funziona così:** la voce usa quella del browser
(ripiego automatico), visione e cervello locale restano spenti; il cervello si
può comunque attivare subito con un provider cloud da *Admin → Config*
(Gemini/DeepSeek/GLM/Claude, serve solo la API key).

---

## Via A — Macchina con Proxmox

### Prerequisiti
- Proxmox VE 8.x, accesso root via shell.
- (Opzionale ma consigliato) GPU NVIDIA con **driver installato sull'host**
  (`nvidia-smi` deve funzionare sull'host). Il P40 è la referenza collaudata.

### Installazione (un comando)
Sull'host Proxmox:

```bash
git clone https://github.com/tnzxpool/VoiceFollower /root/VoiceFollower
bash /root/VoiceFollower/install/proxmox-install.sh
```

Lo script è interattivo e ti fa **scegliere i dischi/storage** (mostra
`pvesm status`), l'ID del container, IP e bridge. Poi:

1. scarica il template Debian 12 se manca;
2. crea il CT `vf-host` (unprivileged, nesting) con bind mount `/vf`;
3. se c'è la GPU, aggiunge il passthrough dei device NVIDIA nel CT;
4. dentro il CT clona la repo in `/opt/voicefollower`, builda l'app e la
   avvia come servizio systemd (`voicefollower`, porta 3000).

A fine corsa stampa l'URL dell'app: `http://<IP-del-CT>:3000`.

### Driver NVIDIA (automatico)
`install/nvidia-driver-setup.sh` fa tutto da solo ed è **idempotente**
(se il driver giusto c'è già, non tocca nulla):

- **sull'host Proxmox**: valuta versione Proxmox/kernel, individua il ramo
  driver adatto alla GPU rilevata (P40/Pascal → 535, GPU recenti → 550),
  scarica il `.run` da download.nvidia.com e lo installa (headers + blacklist
  nouveau inclusi). `proxmox-install.sh` lo lancia da solo se trova una GPU
  senza driver.
- **nel CT** (`--ct`): installa il **solo userland** alla **stessa versione
  dell'host** (letta da `/proc/driver/nvidia/version`), `--no-kernel-modules`.
  Anche questo viene lanciato da `proxmox-install.sh` a fine corsa.

```bash
# rilanciabili a mano in qualsiasi momento:
bash /root/VoiceFollower/install/nvidia-driver-setup.sh          # host
pct exec <ID> -- bash /opt/voicefollower/install/nvidia-driver-setup.sh --ct   # CT
# versione diversa dal default del ramo: NVIDIA_VERSION=xxx.yy.zz bash ...
```

### Modelli (procedura guidata)
Dentro il CT (o dall'host: `pct exec <ID> -- bash ...`):

```bash
bash /opt/voicefollower/install/download-models.sh
```

Menu: **1** voce XTTS-v2 (auto-download ~1.9 GB), **2** visione YOLO-World
(auto-download ~450 MB), **3** cervello locale (llama.cpp compilato + GGUF),
**4** tutto. Rilanciabile: salta ciò che è già installato.

La **lista dei modelli è `install/models.json`**: l'admin la aggiorna
(nuovi modelli, nuovi URL) e rilancia il wizard — è così che si scaricano
modelli nuovi in futuro. Ogni voce dichiara il **`tipo_file`** atteso
(gguf/pt/wav). Per il GGUF del cervello: compilare il campo `url`
(HuggingFace → file .gguf → *Copy download link*) oppure copiare il file in
`/vf/models/` da una macchina esistente.

### Modelli dal pannello admin (incluso l'orchestratore)
Da *Admin → Config → Modelli locali* si scaricano modelli **senza shell**:
si incolla l'URL, si **dichiara il tipo di file atteso** (gguf = orchestratore,
pt = pesi visione, wav = campione voce) e il server verifica **estensione +
firma del file** (magic bytes: `GGUF`/`PK`/`RIFF`) — un file che non
corrisponde viene scartato. I GGUF scaricati compaiono in lista con un
pulsante **"Attiva come orchestratore"**: l'attivazione ricrea il symlink
`/vf/models/vf-brain-current.gguf` (la unit `vf-brain` legge sempre quello,
non va mai modificata) e riavvia `vf-brain`.

### Doctor (idempotenza e controllo versioni)
`install/doctor.sh` è l'audit **sola-lettura, rilanciabile sempre**: verifica
node ≥20, fix gai.conf, allineamento driver CT↔host, torch cu118 e pin
`transformers<5` nei venv, symlink orchestratore, servizi attivi, endpoint
`/health`, allineamento repo con origin/main e build presente. Exit code =
numero di problemi.

```bash
pct exec <ID> -- bash /opt/voicefollower/install/doctor.sh
```

---

## Via B — Macchina con solo Docker

### Prerequisiti
- Docker + docker compose v2.
- Per le funzioni GPU: driver NVIDIA host + `nvidia-container-toolkit`.

### Installazione

```bash
git clone https://github.com/tnzxpool/VoiceFollower
cd VoiceFollower/install/docker

# base: solo app, nessuna GPU, nessun modello
docker compose up -d --build

# con voce + visione su GPU (i modelli si scaricano da soli al primo avvio)
docker compose --profile gpu up -d --build

# anche cervello locale: prima metti il GGUF in ./vfdata/models/
# (e verifica il nome file nel servizio 'brain' del compose)
docker compose --profile gpu --profile brain up -d --build
```

App su `http://<host>:3000`. Dati e modelli in `./vfdata` (equivalente di `/vf`).

---

## Primo avvio (entrambe le vie)

1. Apri `http://<host>:3000` → vista Admin.
2. *Admin → Config*: scegli il provider del cervello (locale o cloud + API key).
3. Voce clonata: registra un campione dal pannello Admin, oppure copia un wav
   in `/vf/tts/voices/` — zero-shot, basta un campione.
4. Kiosk: sulla postazione del paziente apri il browser a schermo intero su
   `http://<host>:3000` e **concedi camera/microfono** (c'è il pulsante
   "Abilita camera/microfono" se il permesso era stato negato).

## Kiosk (la postazione dell'ospite)

Il kiosk è un PC con un browser a tutto schermo: le telecamere IP non possono
farlo (niente browser), ma la scansione le riconosce come sorgenti video.
Dal pannello admin → **Dispositivi in rete & Kiosk** → «Scansiona la rete»
per vedere chi c'è in LAN. Poi, **dal PC scelto**, apri:

```
http://<ip-del-server>:3000/kiosk.bat
```

Doppio click sul file scaricato: crea l'avvio automatico (shell:startup)
e lancia subito il kiosk. Per uscire dal kiosk: ALT+F4.

**E le telecamere IP?** Non possono fare da kiosk (niente browser), ma la
scansione le riconosce (RTSP 554, ONVIF 8899/2020) e molte cam cinesi hanno
microfono e altoparlante: la scansione segnala il *possibile* audio
bidirezionale quando vede ONVIF. Usarle come punti di ascolto/diffusione
audio del companion è un'integrazione futura (serve l'interrogazione ONVIF
GetAudioSources/GetAudioOutputs e il backchannel RTSP): oggi il sistema le
tratta come sorgenti video per la visione.

## Verifica

```bash
curl http://127.0.0.1:3000/api/health      # app
curl http://127.0.0.1:9107/health          # voce  {"ok":true,...}
curl http://127.0.0.1:9106/health          # visione {"ok":true,"gpu":true,...}
curl http://127.0.0.1:9101/health          # cervello locale
systemctl status voicefollower vf-tts vf-vision vf-brain   # (via Proxmox)
```

## Backup e ripristino dei dati vivi

I dati che NON sono nel repo e NON si riscaricano (biografia in `data/`,
`.env`, campioni voce in `/vf/tts/voices`) si salvano con `install/backup-restore.sh`.
I modelli restano fuori: si riscaricano con `download-models.sh`.

```bash
# dentro il CT
bash /opt/voicefollower/install/backup-restore.sh backup /tmp/vf.tar.gz

# dall'host Proxmox: porta il tar fuori dal CT (sopravvive alla sua distruzione)
pct pull 130 /tmp/vf.tar.gz /root/vf-backup.tar.gz

# ripristino dopo una reinstallazione
pct push 130 /root/vf-backup.tar.gz /tmp/vf.tar.gz
pct exec 130 -- bash /opt/voicefollower/install/backup-restore.sh restore /tmp/vf.tar.gz
```

## Disinstallazione completa

`install/uninstall-proxmox.sh` (sull'host Proxmox) distrugge il CT e cancella
modelli/venv in `/srv/lavoro/vf`. Non tocca `/srv/lavoro/ai` né il driver NVIDIA host.
Richiede `--yes` esplicito; fai PRIMA il backup qui sopra.

```bash
bash install/uninstall-proxmox.sh --yes
# per ricreare tutto: bash install/proxmox-install.sh  (poi restore del backup)
```

## Problemi noti (già risolti dagli script, qui per riferimento)

- **Download Python appesi nel CT** (HuggingFace): IPv6 risolve ma non
  instrada. Fix: `precedence ::ffff:0:0/96 100` in `/etc/gai.conf`
  (ct-bootstrap lo fa da solo).
- **coqui-tts + transformers 5.x**: incompatibili → pin `transformers>=4.54,<5`.
- **GPU Pascal (P40)**: usare wheel PyTorch **cu118** e llama.cpp con
  `-DGGML_CUDA_FORCE_MMQ=ON`.
- **Permessi su /vf** (Proxmox, CT unprivileged): le cartelle create sull'host
  vanno `chown -R 100000:100000` (proxmox-install lo fa da solo).
