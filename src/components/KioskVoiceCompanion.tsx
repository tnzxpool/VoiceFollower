/**
 * Ciclo vocale per la postazione kiosk (.4): ascolta in continuo col microfono,
 * manda la frase al cervello (/api/orchestrate) e risponde a voce.
 * Pensato per convivere con la griglia di sorveglianza: barra fissa in basso,
 * stile denso, niente effetti. Mentre parla NON ascolta (evita che si senta da solo
 * attraverso la cassa).
 *
 * Musica di sottofondo (nizix 2026-08-17): player comandato dal cervello
 * (campo "music" nel JSON voiceMode: play/stop/keep). I brani stanno in
 * data/music/ sulla macchina che serve l'app. Quando il companion pensa o
 * parla, il volume scende quasi a zero (ducking) e poi risale dolcemente.
 * La musica esce dalla STESSA cassa della voce: così l'AEC del browser
 * (echoCancellation) la cancella dal microfono e il riconoscimento continua
 * a sentire la persona nonostante il sottofondo.
 */
import { useEffect, useRef, useState } from "react";
import { Mic, Loader2, Volume2, AlertTriangle, Music, AlarmClock } from "lucide-react";
import { speakText, stopSpeaking, createSpeechRecognizer, getLastVoiceName } from "../utils/speech";

type Stato = "ascolto" | "penso" | "parlo" | "senza-microfono";

const VOL_MUSICA = 0.35; // volume di crociera del sottofondo
const VOL_DUCK = 0.04;   // volume durante il dialogo (quasi zero)

export default function KioskVoiceCompanion() {
  const [stato, setStato] = useState<Stato>("ascolto");
  const [sentito, setSentito] = useState("");
  const [interim, setInterim] = useState("");
  const [risposta, setRisposta] = useState("");
  const [musicaOn, setMusicaOn] = useState(false);
  // Orologio + sveglia (disattiva di default, si abilita a voce: "metti la sveglia alle 8")
  const [ora, setOra] = useState("");
  const [sveglia, setSveglia] = useState<{ enabled: boolean; time: string }>({ enabled: false, time: "08:00" });
  const svegliaRef = useRef(sveglia);
  const svegliaSuonataRef = useRef("");
  const busyRef = useRef(false);
  const recRef = useRef<any>(null);
  const disposedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const braniRef = useRef<string[]>([]);
  const duckTimerRef = useRef<any>(null);
  const musicaOnRef = useRef(false);

  // Rampa dolce del volume (niente stacchi bruschi: attack/release ~0.5-1s)
  const volumeVerso = (target: number, poi?: () => void) => {
    const a = audioRef.current;
    if (!a) return;
    if (duckTimerRef.current) clearInterval(duckTimerRef.current);
    duckTimerRef.current = setInterval(() => {
      const el = audioRef.current;
      if (!el) { clearInterval(duckTimerRef.current); return; }
      const diff = target - el.volume;
      if (Math.abs(diff) < 0.03) {
        el.volume = Math.max(0, Math.min(1, target));
        clearInterval(duckTimerRef.current);
        if (poi) poi();
      } else {
        el.volume = Math.max(0, Math.min(1, el.volume + Math.sign(diff) * 0.03));
      }
    }, 60);
  };

  const prossimoBrano = () => {
    const brani = braniRef.current;
    const a = audioRef.current;
    if (!a || !brani.length || !musicaOnRef.current) return;
    const scelto = brani[Math.floor(Math.random() * brani.length)];
    a.src = "/music/" + encodeURIComponent(scelto);
    a.play().catch(() => {});
  };

  const avviaMusica = (): boolean => {
    const brani = braniRef.current;
    if (!brani.length) return false;
    if (!audioRef.current) {
      const a = new Audio();
      a.onended = () => prossimoBrano();
      audioRef.current = a;
    }
    musicaOnRef.current = true;
    setMusicaOn(true);
    audioRef.current.volume = 0;
    prossimoBrano();
    volumeVerso(busyRef.current ? VOL_DUCK : VOL_MUSICA);
    return true;
  };

  const fermaMusica = () => {
    musicaOnRef.current = false;
    setMusicaOn(false);
    volumeVerso(0, () => {
      try { audioRef.current?.pause(); } catch {}
    });
  };

  const duck = () => { if (musicaOnRef.current) volumeVerso(VOL_DUCK); };
  const risali = () => { if (musicaOnRef.current) volumeVerso(VOL_MUSICA); };

  useEffect(() => {
    disposedRef.current = false;

    // Elenco brani disponibili sul server (data/music/)
    fetch("/api/music/list")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d?.files)) braniRef.current = d.files; })
      .catch(() => {});

    // Stato sveglia dal server (persistente, comandabile a voce)
    const aggiornaSveglia = (s: any) => {
      if (s && typeof s.enabled === "boolean" && typeof s.time === "string") {
        svegliaRef.current = { enabled: s.enabled, time: s.time };
        setSveglia(svegliaRef.current);
      }
    };
    fetch("/api/alarm").then(r => r.json()).then(aggiornaSveglia).catch(() => {});

    // Orologio a bordo barra + scatto sveglia (controllo ogni 5 s)
    const tick = () => {
      const adesso = new Date();
      const hhmm = adesso.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
      setOra(hhmm);
      const s = svegliaRef.current;
      const chiave = adesso.toDateString() + " " + s.time;
      if (s.enabled && hhmm === s.time && svegliaSuonataRef.current !== chiave && !busyRef.current) {
        svegliaSuonataRef.current = chiave;
        busyRef.current = true;
        try { recRef.current?.stop(); } catch {}
        setStato("parlo");
        duck();
        speakText(`È l'ora che avevi chiesto: sono le ${s.time.replace(":", " e ")}.`, {
          onEnd: () => {
            busyRef.current = false;
            if (!disposedRef.current) { setStato("ascolto"); risali(); try { recRef.current?.start(); } catch {} }
          }
        });
      }
    };
    tick();
    const orologioTimer = setInterval(tick, 5000);

    const riparti = () => {
      if (disposedRef.current || busyRef.current) return;
      try { recRef.current?.start(); } catch { /* gia' avviato */ }
    };

    const tornaInAscolto = () => {
      busyRef.current = false;
      if (!disposedRef.current) {
        setStato("ascolto");
        risali();
        riparti();
      }
    };

    // Promemoria e check-in proattivi (clone offline di KindredMind):
    // ogni 30 s chiede al cervello se c'è qualcosa da dire di iniziativa.
    const controllaDue = () => {
      if (disposedRef.current || busyRef.current) return;
      fetch("/api/kiosk/due")
        .then(r => r.json())
        .then(d => {
          if (disposedRef.current || busyRef.current || !d?.kind) return;
          if (d.kind === "reminder" && d.say) {
            busyRef.current = true;
            try { recRef.current?.stop(); } catch {}
            setSentito("");
            setRisposta(d.say);
            setStato("parlo");
            duck();
            speakText(d.say, { onEnd: tornaInAscolto });
          } else if (d.kind === "checkin") {
            busyRef.current = true;
            try { recRef.current?.stop(); } catch {}
            setSentito("");
            setStato("penso");
            duck();
            fetch("/api/orchestrate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: "(check-in proattivo automatico: apri tu la conversazione, con calore e da pari, come un familiare che passa a salutare. Se c'è una novità di famiglia vera raccontala, altrimenti UNA domanda aperta leggera. Breve.)",
                voiceMode: true
              })
            })
              .then(r => r.json())
              .then(d2 => {
                const detto = (d2?.spokenResponse || "").trim();
                if (detto && !disposedRef.current) {
                  setRisposta(detto);
                  setStato("parlo");
                  speakText(detto, { onEnd: tornaInAscolto });
                } else {
                  tornaInAscolto();
                }
              })
              .catch(() => tornaInAscolto());
          }
        })
        .catch(() => {});
    };
    const dueTimer = setInterval(controllaDue, 30000);

    const rec = createSpeechRecognizer({
      language: "it-IT",
      onResult: (testo, finale) => {
        if (busyRef.current) return;
        if (!finale) { setInterim(testo); return; }
        const frase = testo.trim();
        setInterim("");
        if (frase.length < 4) return;

        busyRef.current = true;
        try { recRef.current?.stop(); } catch {}
        setSentito(frase);
        setRisposta("");
        setStato("penso");
        duck();

        fetch("/api/orchestrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: frase, voiceMode: true })
        })
          .then(r => r.json())
          .then(d => {
            let detto = (d?.spokenResponse || "").trim();

            // Comando musica deciso dal cervello
            const cmd = String(d?.music || "").toLowerCase();
            if (cmd === "play") {
              const ok = avviaMusica();
              if (!ok) detto = detto || "Non ho brani da suonare: il caregiver deve caricare la musica.";
            } else if (cmd === "stop") {
              fermaMusica();
            }

            // Stato sveglia aggiornato dal server (comandi vocali "metti la sveglia...")
            aggiornaSveglia(d?.alarm);

            setRisposta(detto);
            if (detto && !disposedRef.current) {
              setStato("parlo");
              speakText(detto, { onEnd: tornaInAscolto });
            } else {
              tornaInAscolto();
            }
          })
          .catch(() => {
            setRisposta("(il cervello non ha risposto: riprova)");
            tornaInAscolto();
          });
      },
      onError: () => {
        // errori transitori (no-speech ecc.): il riavvio lo fa onend
      }
    });

    recRef.current = rec;
    if (!rec) {
      setStato("senza-microfono");
      return () => { disposedRef.current = true; clearInterval(orologioTimer); clearInterval(dueTimer); };
    }

    // Edge/Chrome fermano il riconoscimento dopo un silenzio: riavvio continuo
    rec.onend = () => {
      if (!disposedRef.current && !busyRef.current) {
        setTimeout(riparti, 300);
      }
    };
    try { rec.start(); } catch {}

    return () => {
      disposedRef.current = true;
      clearInterval(orologioTimer);
      clearInterval(dueTimer);
      try { rec.stop(); } catch {}
      stopSpeaking();
      musicaOnRef.current = false;
      if (duckTimerRef.current) clearInterval(duckTimerRef.current);
      try { audioRef.current?.pause(); } catch {}
    };
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 text-slate-100 border-t-2 border-slate-500 px-3 py-2 text-sm font-mono">
      <div className="flex items-center gap-3">
        {stato === "ascolto" && (
          <span className="flex items-center gap-1.5 text-emerald-400 shrink-0">
            <Mic className="w-4 h-4" /> ASCOLTO
          </span>
        )}
        {stato === "penso" && (
          <span className="flex items-center gap-1.5 text-amber-400 shrink-0">
            <Loader2 className="w-4 h-4 animate-spin" /> PENSO...
          </span>
        )}
        {stato === "parlo" && (
          <span className="flex items-center gap-1.5 text-sky-400 shrink-0">
            <Volume2 className="w-4 h-4" /> PARLO
            <span className="text-sky-600 text-xs">[{getLastVoiceName() || "?"}]</span>
          </span>
        )}
        {stato === "senza-microfono" && (
          <span className="flex items-center gap-1.5 text-red-400 shrink-0">
            <AlertTriangle className="w-4 h-4" /> RICONOSCIMENTO VOCALE NON DISPONIBILE
          </span>
        )}
        {musicaOn && (
          <span className="flex items-center gap-1 text-violet-400 shrink-0 text-xs">
            <Music className="w-3.5 h-3.5" /> MUSICA
          </span>
        )}
        <span className="flex items-center gap-1 text-slate-300 shrink-0 text-xs tabular-nums">
          {ora}
          {sveglia.enabled && (
            <span className="flex items-center gap-0.5 text-orange-400">
              <AlarmClock className="w-3.5 h-3.5" /> {sveglia.time}
            </span>
          )}
        </span>
        <span className="text-slate-400 truncate">
          {interim
            ? <>«{interim}»</>
            : sentito
              ? <>Ho sentito: «{sentito}»{risposta ? <> — Risposta: «{risposta}»</> : null}</>
              : "Parla e ti rispondo dalla cassa."}
        </span>
      </div>
    </div>
  );
}
