# VoiceFollower

> Compagno vocale locale per persone con Alzheimer: kiosk semplice per l'ospite, pannello completo per il caregiver. Tutto gira in casa, su GPU locale — nessun dato personale esce dalla rete.

## Autore

- **nizix** — [github.com/tnzxpool](https://github.com/tnzxpool)

## Cos'è

VoiceFollower è un sistema di assistenza vocale pensato per accompagnare una persona con decadimento cognitivo:

- **Vista Ospite (kiosk)**: interfaccia grande e calma. La persona parla, il sistema risponde a voce con tono rassicurante, ricordando dove si trova e chi le è vicino.
- **Vista Caregiver (admin)**: gestione completa — profilo e biografia della persona, grafo di conoscenza (famiglia, luoghi, abitudini), download e attivazione dei modelli AI, diagnostica dei servizi.

L'orchestratore (LLM locale), la sintesi vocale (XTTS con clonazione voce), la visione e gli embedding girano tutti su una GPU locale. Nessuna chiamata cloud obbligatoria.

## Architettura

```
Kiosk (browser) ──► App Node/Express :3000
                        │
        ┌───────────────┼──────────────────┐
        ▼               ▼                  ▼
   vf-brain :9101   vf-tts :9107      vf-vision :9106
   (llama.cpp,      (XTTS v2,         (YOLO-World)
    orchestratore)   voce clonata)
        ▼
   vf-prep :9102 · vf-embed :9105 (ausiliari CPU, opzionali)
```

Tutti i servizi sono unit systemd dentro un container LXC (o container Docker, a scelta). Modelli e voci vivono in `/vf/models`, `/vf/vision/models`, `/vf/tts/voices`.

## Installazione rapida

**Via A — Proxmox (consigliata, testata su pve 8.4 + Tesla P40):**

```bash
git clone https://github.com/tnzxpool/VoiceFollower.git
cd VoiceFollower
bash install/proxmox-install.sh
```

Lo script è idempotente: crea il CT, rileva la versione Proxmox, individua e installa il driver NVIDIA adatto (host + userland CT), fa il bootstrap dei servizi e stampa i passi successivi. Rilanciarlo non rompe nulla.

**Via B — Docker:**

```bash
docker compose --profile gpu up -d --build
```

**Modelli:** si scaricano dal **pannello admin** (`http://<host>:3000` → Configurazione → Modelli) oppure con il wizard:

```bash
bash install/download-models.sh
```

Ogni download dichiara il tipo di file atteso (`.gguf` per l'orchestratore, `.pt` per la visione, `.wav` per i campioni voce) e viene validato sui magic bytes. L'orchestratore attivo è un symlink (`vf-brain-current.gguf`): cambiare modello dal pannello non tocca le unit.

**Verifica:**

```bash
bash install/doctor.sh
```

Audit read-only di tutta la catena (driver, servizi, porte, modelli, permessi). Exit code = numero di problemi.

**Backup / disinstallazione:** `install/backup-restore.sh` salva i dati vivi (biografia, `.env`, voci — i modelli si riscaricano); `install/uninstall-proxmox.sh --yes` rimuove tutto dall'host. Repo + backup = ricostruzione totale.

**Manuale completo:** [INSTALL.md](INSTALL.md) — requisiti, passthrough GPU, driver, backup, troubleshooting.

## Privacy — leggere prima di usare

- La cartella `data/` (biografia vera, memoria, database) è **esclusa dal repo** e resta sulla macchina.
- I **campioni voce** (`*.wav`) non entrano mai nel repo.
- Il **grafo di conoscenza parte vuoto**: nomi, famiglia e ricordi li inserisce solo il caregiver dal pannello admin. Il codice non contiene dati di persone reali.
- Il sistema è pensato per rete locale (LAN). Nessuna telemetria.

## Struttura del repo

```
src/            UI React (kiosk + admin)
server.ts       API Express (orchestrazione, TTS, modelli, admin)
install/        proxmox-install.sh · nvidia-driver-setup.sh ·
                ct-bootstrap.sh · download-models.sh · doctor.sh · models.json
services/       microservizi Python (tts, vision, prep, embed)
host/           script operativi di deploy/diagnostica (uso locale)
INSTALL.md      manuale di installazione completo
```

## Licenza

**GNU AGPL v3 o successiva** — vedi [LICENSE](LICENSE).

Copyright © 2026 nizix. Questo programma è software libero: puoi
ridistribuirlo e modificarlo secondo i termini della GNU Affero General
Public License; ogni versione derivata deve restare libera con la stessa
licenza. Clausola di rete: chi modifica il software e lo offre come
servizio via rete deve rendere disponibile il sorgente modificato agli
utenti di quel servizio. Nessuna garanzia. I dati personali dell'ospite
(cartella `data/`, voci) NON fanno parte del software e non sono coperti
da questa licenza.
