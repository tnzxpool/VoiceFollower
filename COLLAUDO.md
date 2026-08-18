# Collaudo VoiceFollower — vf-host (192.168.1.89)

Versione a schermo (stessi passi, cliccabile): **http://192.168.1.89:3000/collaudo.html**

Spunta ogni passo. Se un passo fallisce, vai ai rimedi in fondo.

## 1 · Salute del sistema

- [ ] Apri http://192.168.1.89:3000/api/health → **Atteso:** testo che inizia con `{"status":"ok"`
- [ ] Apri http://192.168.1.89:9101/health (cervello locale) → **Atteso:** `{"status":"ok"}`

## 2 · Postazione kiosk (.4)

- [ ] Sul PC .4: doppio click su `Desktop\KIOSK_4.bat` (oppure riavvia il PC)
      → **Atteso:** Chrome a tutto schermo, vista sorveglianza, indirizzo `192.168.1.89:3000`. Uscita: ALT+F4.

## 3 · Procedura guidata (verifica motori)

- [ ] Apri http://192.168.1.89:3000/?vista=caregiver → scheda **«Motori Multi-LLM & API Keys»** → pulsante **«Procedura guidata»**
      → **Atteso:** i 4 passi (server, motore LLM, provider, prova reale) verdi. «Provider» può essere giallo/rosso senza chiavi cloud: va bene, il cervello locale basta.

## 4 · Prova con la voce (vista paziente)

- [ ] Apri http://192.168.1.89:3000/?vista=companion&kiosk=1 e concedi il microfono
      → **Atteso:** vista compagno a schermo intero, data e ora visibili.
- [ ] Dì ad alta voce: **«Non trovo i miei occhiali»** → **Atteso:** risposta calma e breve in italiano, parlata e scritta.
- [ ] Dì: **«Che giorno è oggi?»** → **Atteso:** risposta con la data corretta.

## Rimedi

- **Le pagine .89 non si aprono** → vf-host spento. Apri https://192.168.1.88:8006 (Proxmox) → CT **130 (vf-host)** → **Avvia**. Attendi 2 minuti, riprova il punto 1.
- **Il kiosk mostra 192.168.1.3 invece di .89** → .89 era spento all'avvio del kiosk: è la riserva, va bene. Per ripuntarlo: doppio click su `Desktop\KIOSK_4.bat` con .89 acceso.
- **Cervello lentissimo o in inglese** → segnalalo a Claude: si regola il modello (porta 9101) senza toccare l'app.
- **Altro** → scrivi a Claude cosa hai visto sullo schermo al passo fallito.
