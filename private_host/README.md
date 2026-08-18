# 🔒 EdgeMesh Host Master — Private Host Suite

**Autore & Sviluppatore**: [nizix](https://github.com/tnzxpool)  
**Repository**: [https://github.com/tnzxpool](https://github.com/tnzxpool)

---

## 📦 Contenuto della Cartella Privata

Questa cartella (`/private_host`) contiene tutti gli script e le configurazioni per distribuire l'architettura **EdgeMesh Host Master** su un server privato (VPS, server casalingo Linux, Raspberry Pi 5 o workstation):

1. **`docker-compose.yml`**: Stack completo multi-container:
   - `edgemesh-master-core`: Server Express + Frontend React + Multi-LLM Bridge.
   - `edgemesh-postgres`: Database relazionale PostgreSQL 16 con tabelle dialetti e grafo.
   - `edgemesh-redis`: Coda veloce in memoria per streaming duplex audio/video e buffer aptico.
   - `edgemesh-chroma`: Vector Database per la memoria RAG semantica.
   - `edgemesh-ollama`: NPU neurale locale per funzionamento 100% offline (Air-Gap).
2. **`Dockerfile`**: Build ottimizzata multi-stage Node.js 20 con healthcheck integrato.
3. **`init_db.sql`**: Schema del database SQL con indici di ricerca sub-millisecondo e dati iniziali pre-popolati per dialetti regionali e parole inventate.
4. **`deploy_master.sh`**: Script bash di installazione e avvio automatizzato con un solo comando.
5. **`backup_restore.sh`**: Utility di backup e ripristino istantaneo per esportare l'intero database in file SQL o ripristinarlo dopo una migrazione.

---

## ⚡ Avvio Rapido del Server Privato

```bash
# 1. Entra nella cartella di deploy
cd private_host

# 2. Rendi eseguibili gli script
chmod +x deploy_master.sh backup_restore.sh

# 3. Avvia l'intero stack
./deploy_master.sh
```

---

## 💾 Backup & Ripristino Dati

```bash
# Per effettuare un backup manuale del database:
./backup_restore.sh backup

# Per ripristinare un backup precedente:
./backup_restore.sh restore ./backups/edgemesh_backup_YYYYMMDD_HHMMSS.sql
```

---

## 🔐 Sicurezza & Gestione Credenziali

- Non effettuare mai il commit del file `.env` contenente le chiavi API reali su repository pubblici.
- Il file `.gitignore` del progetto principale protegge automaticamente qualsiasi file `.env`.
