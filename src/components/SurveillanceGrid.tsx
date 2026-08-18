import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Eye,
  Camera,
  Mic,
  Activity,
  Bell,
  Volume2,
  VolumeX,
  Pause,
  Play,
  AlertTriangle,
  Waves,
  ScanEye
} from "lucide-react";
import { SurveillanceEvent, SurveillanceEventType } from "../types";

/**
 * SurveillanceGrid — Sorveglianza ambientale multi-fonte SENZA pulsante.
 *
 * Principio: il sistema è "ambient". Appena la vista è attiva (e i permessi
 * concessi), TUTTE le camere e TUTTI i microfoni disponibili vengono
 * enumerati, suddivisi automaticamente in postazioni e monitorati in
 * continuo. L'utente (paziente) non deve premere nulla: l'attivazione è
 * guidata dagli eventi (movimento, rumore forte, silenzio anomalo).
 * Il caregiver può mettere in pausa dalla propria vista — è un override,
 * non un requisito operativo.
 */

interface VideoStation {
  deviceId: string;
  label: string;
  stream: MediaStream | null;
  error?: string;
}

interface AudioStation {
  deviceId: string;
  label: string;
  level: number; // RMS 0..1
  error?: string;
}

interface LocalEvent {
  id: string;
  type: SurveillanceEventType;
  sourceLabel: string;
  timestamp: string;
  detail: string;
  snapshot?: string;
  serverAnalysis?: string;
}

const MOTION_INTERVAL_MS = 500;
const AUDIO_INTERVAL_MS = 250;
const EVENT_COOLDOWN_MS = 15000; // anti-spam per fonte+tipo

export const SurveillanceGrid: React.FC = () => {
  const [monitoring, setMonitoring] = useState(true);
  const [permissionState, setPermissionState] = useState<"pending" | "granted" | "denied">("pending");
  // Controllo dispositivi dal banner permessi: ritenta il prompt del browser / spegne le fonti
  const [devicesOff, setDevicesOff] = useState(false);
  const [retrySeq, setRetrySeq] = useState(0);
  const [videoStations, setVideoStations] = useState<VideoStation[]>([]);
  const [audioStations, setAudioStations] = useState<AudioStation[]>([]);
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [motionScores, setMotionScores] = useState<Record<string, number>>({});

  // Configurazione soglie (regolabile dal caregiver, non richiesta al paziente)
  const [motionSensitivity, setMotionSensitivity] = useState(8); // % pixel cambiati
  const [noiseThreshold, setNoiseThreshold] = useState(0.22); // RMS
  const [silenceMinutes, setSilenceMinutes] = useState(20);
  const [aiAnalysis, setAiAnalysis] = useState(true);

  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const prevFramesRef = useRef<Record<string, Uint8ClampedArray | null>>({});
  const analysersRef = useRef<Record<string, AnalyserNode>>({});
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioStreamsRef = useRef<MediaStream[]>([]);
  const lastEventTsRef = useRef<Record<string, number>>({});
  const lastSoundTsRef = useRef<number>(Date.now());
  const silenceAlertedRef = useRef<boolean>(false);
  const monitoringRef = useRef(monitoring);
  monitoringRef.current = monitoring;

  const sensRef = useRef({ motionSensitivity, noiseThreshold, silenceMinutes, aiAnalysis });
  sensRef.current = { motionSensitivity, noiseThreshold, silenceMinutes, aiAnalysis };

  // ---------------------------------------------------------------
  // Invio evento al server (che genera alert caregiver + analisi AI)
  // ---------------------------------------------------------------
  const emitEvent = useCallback(
    async (
      type: SurveillanceEventType,
      sourceLabel: string,
      detail: string,
      snapshot?: string
    ) => {
      const key = `${type}::${sourceLabel}`;
      const now = Date.now();
      if (now - (lastEventTsRef.current[key] || 0) < EVENT_COOLDOWN_MS) return;
      lastEventTsRef.current[key] = now;

      const localEvt: LocalEvent = {
        id: `evt_${now}_${Math.random().toString(36).slice(2, 7)}`,
        type,
        sourceLabel,
        detail,
        snapshot,
        timestamp: new Date().toLocaleTimeString("it-IT")
      };
      setEvents(prev => [localEvt, ...prev].slice(0, 60));

      try {
        const res = await fetch("/api/surveillance/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            sourceLabel,
            detail,
            snapshot,
            analyze: sensRef.current.aiAnalysis
          })
        });
        const data = await res.json();
        if (data?.event?.aiAnalysis) {
          setEvents(prev =>
            prev.map(e =>
              e.id === localEvt.id ? { ...e, serverAnalysis: data.event.aiAnalysis } : e
            )
          );
        }
      } catch {
        // offline: l'evento resta comunque nel log locale
      }
    },
    []
  );

  // ---------------------------------------------------------------
  // Bootstrap: permessi + enumerazione + apertura automatica fonti
  // ---------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    const openedStreams: MediaStream[] = [];

    const boot = async () => {
      // 1. Richiesta permessi generica (necessaria per ottenere label reali)
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        probe.getTracks().forEach(t => t.stop());
        if (cancelled) return;
        setPermissionState("granted");
      } catch {
        if (!cancelled) setPermissionState("denied");
        return;
      }

      // 2. Enumerazione e suddivisione automatica delle fonti
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter(d => d.kind === "videoinput");
      const seenGroups = new Set<string>();
      const mics = devices.filter(d => {
        if (d.kind !== "audioinput") return false;
        // dedupe dispositivi virtuali "default"/"communications" (Windows)
        if (d.deviceId === "default" || d.deviceId === "communications") return false;
        if (d.groupId && seenGroups.has(d.groupId)) return false;
        if (d.groupId) seenGroups.add(d.groupId);
        return true;
      });

      // 3. Apertura di TUTTE le camere (bassa risoluzione: il lavoro pesante sta sull'hub)
      const vStations: VideoStation[] = [];
      for (const cam of cams) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: cam.deviceId }, width: { ideal: 320 }, height: { ideal: 240 } },
            audio: false
          });
          openedStreams.push(stream);
          vStations.push({
            deviceId: cam.deviceId,
            label: cam.label || `Camera ${vStations.length + 1}`,
            stream
          });
        } catch (e: any) {
          vStations.push({
            deviceId: cam.deviceId,
            label: cam.label || `Camera ${vStations.length + 1}`,
            stream: null,
            error: e?.name || "Errore apertura"
          });
        }
      }
      if (cancelled) {
        openedStreams.forEach(s => s.getTracks().forEach(t => t.stop()));
        return;
      }
      setVideoStations(vStations);

      // 4. Apertura di TUTTI i microfoni distinti con analisi RMS continua
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const aStations: AudioStation[] = [];
      for (const mic of mics) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: mic.deviceId }, echoCancellation: true, noiseSuppression: true }
          });
          openedStreams.push(stream);
          audioStreamsRef.current.push(stream);
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          src.connect(analyser);
          analysersRef.current[mic.deviceId] = analyser;
          aStations.push({
            deviceId: mic.deviceId,
            label: mic.label || `Microfono ${aStations.length + 1}`,
            level: 0
          });
        } catch (e: any) {
          aStations.push({
            deviceId: mic.deviceId,
            label: mic.label || `Microfono ${aStations.length + 1}`,
            level: 0,
            error: e?.name || "Errore apertura"
          });
        }
      }
      if (cancelled) {
        openedStreams.forEach(s => s.getTracks().forEach(t => t.stop()));
        return;
      }
      setAudioStations(aStations);
      lastSoundTsRef.current = Date.now();
    };

    if (devicesOff) {
      // Dispositivi disattivati dal caregiver: nessuna fonte aperta
      setVideoStations([]);
      setAudioStations([]);
      setPermissionState("pending");
    } else {
      boot();
    }

    return () => {
      cancelled = true;
      openedStreams.forEach(s => s.getTracks().forEach(t => t.stop()));
      audioStreamsRef.current = [];
      analysersRef.current = {};
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, [devicesOff, retrySeq]);

  // ---------------------------------------------------------------
  // Loop rilevamento MOVIMENTO (frame differencing per ogni camera)
  // ---------------------------------------------------------------
  useEffect(() => {
    if (videoStations.length === 0) return;
    const W = 64;
    const H = 48;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const interval = setInterval(() => {
      if (!monitoringRef.current) return;
      const scores: Record<string, number> = {};

      for (const station of videoStations) {
        const video = videoRefs.current[station.deviceId];
        if (!video || !station.stream || video.readyState < 2) continue;

        ctx.drawImage(video, 0, 0, W, H);
        const frame = ctx.getImageData(0, 0, W, H).data;
        const prev = prevFramesRef.current[station.deviceId];

        if (prev) {
          let changed = 0;
          const total = W * H;
          for (let i = 0; i < frame.length; i += 4) {
            const g1 = (frame[i] + frame[i + 1] + frame[i + 2]) / 3;
            const g2 = (prev[i] + prev[i + 1] + prev[i + 2]) / 3;
            if (Math.abs(g1 - g2) > 28) changed++;
          }
          const pct = (changed / total) * 100;
          scores[station.deviceId] = pct;

          if (pct >= sensRef.current.motionSensitivity) {
            // Snapshot a risoluzione piena della postazione che ha rilevato
            const snapCanvas = document.createElement("canvas");
            snapCanvas.width = video.videoWidth || 320;
            snapCanvas.height = video.videoHeight || 240;
            const sctx = snapCanvas.getContext("2d");
            let snapshot: string | undefined;
            if (sctx) {
              sctx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
              snapshot = snapCanvas.toDataURL("image/jpeg", 0.7);
            }
            emitEvent(
              "MOVIMENTO",
              station.label,
              `Movimento rilevato (${pct.toFixed(1)}% area)`,
              snapshot
            );
          }
        }
        prevFramesRef.current[station.deviceId] = new Uint8ClampedArray(frame);
      }
      setMotionScores(scores);
    }, MOTION_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [videoStations, emitEvent]);

  // ---------------------------------------------------------------
  // Loop rilevamento AUDIO (RMS, rumore forte, silenzio anomalo)
  // ---------------------------------------------------------------
  useEffect(() => {
    if (audioStations.length === 0) return;
    const buf = new Uint8Array(512);

    const interval = setInterval(() => {
      if (!monitoringRef.current) return;
      let maxRms = 0;

      setAudioStations(prev =>
        prev.map(st => {
          const analyser = analysersRef.current[st.deviceId];
          if (!analyser) return st;
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buf.length);
          if (rms > maxRms) maxRms = rms;

          if (rms >= sensRef.current.noiseThreshold) {
            emitEvent("RUMORE_FORTE", st.label, `Rumore forte rilevato (RMS ${rms.toFixed(2)})`);
          }
          return { ...st, level: rms };
        })
      );

      // Silenzio anomalo: nessun suono sopra soglia minima per N minuti
      if (maxRms > 0.05) {
        lastSoundTsRef.current = Date.now();
        silenceAlertedRef.current = false;
      } else {
        const silentMs = Date.now() - lastSoundTsRef.current;
        if (
          !silenceAlertedRef.current &&
          silentMs > sensRef.current.silenceMinutes * 60 * 1000
        ) {
          silenceAlertedRef.current = true;
          emitEvent(
            "SILENZIO_ANOMALO",
            "Tutte le postazioni audio",
            `Nessun suono ambientale da ${sensRef.current.silenceMinutes} minuti`
          );
        }
      }
    }, AUDIO_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [audioStations.length, emitEvent]);

  // ---------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------
  const eventBadge = (type: SurveillanceEventType) => {
    switch (type) {
      case "MOVIMENTO":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "RUMORE_FORTE":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "SILENZIO_ANOMALO":
        return "bg-rose-100 text-rose-800 border-rose-200";
    }
  };

  return (
    <div className="space-y-4">
      {/* Barra stato: nessun pulsante di attivazione richiesto — solo pausa caregiver */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${monitoring ? "bg-emerald-100" : "bg-slate-100"}`}>
            <ScanEye className={`w-5 h-5 ${monitoring ? "text-emerald-600" : "text-slate-400"}`} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              Sorveglianza Ambientale Multi-Fonte
              {monitoring && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  ATTIVA — SEMPRE IN ASCOLTO
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500">
              {videoStations.length} postazioni video · {audioStations.length} postazioni audio ·
              attivazione automatica a eventi, nessuna azione richiesta al paziente
            </p>
          </div>
        </div>
        <button
          onClick={() => setMonitoring(m => !m)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
            monitoring
              ? "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
              : "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700"
          }`}
        >
          {monitoring ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {monitoring ? "Pausa (solo caregiver)" : "Riprendi sorveglianza"}
        </button>
      </div>

      {devicesOff && (
        <div className="flex flex-wrap items-center gap-3 bg-slate-100 border border-slate-200 text-slate-700 rounded-xl p-4 text-sm">
          <VolumeX className="w-4 h-4 shrink-0" />
          <span className="flex-1 min-w-[220px]">
            Camera e microfono disattivati su questa postazione.
          </span>
          <button
            onClick={() => setDevicesOff(false)}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
          >
            Riattiva camera/microfono
          </button>
        </div>
      )}

      {!devicesOff && permissionState === "denied" && (
        <div className="flex flex-wrap items-center gap-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="flex-1 min-w-[220px]">
            Permessi camera/microfono negati. Riprova qui sotto (il browser rifarà la domanda);
            se il blocco è permanente, sbloccali dall'icona del lucchetto nella barra
            dell'indirizzo o da <span className="font-mono">chrome://settings/content/camera</span>.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPermissionState("pending");
                setRetrySeq(s => s + 1);
              }}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
            >
              Abilita camera/microfono
            </button>
            <button
              onClick={() => setDevicesOff(true)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-rose-200 text-rose-700 hover:bg-rose-100 transition-all"
            >
              Non usarli su questa postazione
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Colonna 1-2: griglia camere */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {videoStations.map(st => (
              <div
                key={st.deviceId}
                className="relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 aspect-video"
              >
                {st.stream ? (
                  <video
                    ref={el => {
                      videoRefs.current[st.deviceId] = el;
                      if (el && el.srcObject !== st.stream) {
                        el.srcObject = st.stream;
                        el.play().catch(() => {});
                      }
                    }}
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs font-mono">
                    {st.error || "Non disponibile"}
                  </div>
                )}
                <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur rounded-lg px-2 py-1">
                  <Camera className="w-3 h-3 text-white" />
                  <span className="text-[10px] font-mono text-white truncate max-w-[160px]">
                    {st.label}
                  </span>
                </div>
                {(motionScores[st.deviceId] || 0) >= motionSensitivity && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-rose-600 rounded-lg px-2 py-1 animate-pulse">
                    <Activity className="w-3 h-3 text-white" />
                    <span className="text-[10px] font-bold text-white">MOVIMENTO</span>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 right-2 h-1 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-400 transition-all duration-300"
                    style={{ width: `${Math.min(100, (motionScores[st.deviceId] || 0) * 5)}%` }}
                  />
                </div>
              </div>
            ))}
            {videoStations.length === 0 && permissionState === "granted" && (
              <div className="col-span-full text-center text-sm text-slate-400 py-10 border border-dashed border-slate-300 rounded-2xl">
                Nessuna camera rilevata su questa postazione
              </div>
            )}
          </div>

          {/* Postazioni audio */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Waves className="w-3.5 h-3.5 text-indigo-500" />
              Postazioni Audio ({audioStations.length})
            </h3>
            {audioStations.map(st => (
              <div key={st.deviceId} className="flex items-center gap-3">
                {st.level >= noiseThreshold ? (
                  <Volume2 className="w-4 h-4 text-amber-500 shrink-0" />
                ) : (
                  <Mic className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <span className="text-xs text-slate-600 font-mono truncate w-44 shrink-0">
                  {st.label}
                </span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 ${
                      st.level >= noiseThreshold ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, st.level * 250)}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-slate-400 w-10 text-right">
                  {st.error ? "ERR" : st.level.toFixed(2)}
                </span>
              </div>
            ))}
            {audioStations.length === 0 && permissionState === "granted" && (
              <p className="text-xs text-slate-400">Nessun microfono distinto rilevato</p>
            )}
          </div>

          {/* Configurazione soglie */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Sensibilità movimento: {motionSensitivity}%
              </label>
              <input
                type="range"
                min={2}
                max={30}
                value={motionSensitivity}
                onChange={e => setMotionSensitivity(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Soglia rumore: {noiseThreshold.toFixed(2)}
              </label>
              <input
                type="range"
                min={0.1}
                max={0.6}
                step={0.02}
                value={noiseThreshold}
                onChange={e => setNoiseThreshold(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Allarme silenzio: {silenceMinutes} min
              </label>
              <input
                type="range"
                min={5}
                max={60}
                step={5}
                value={silenceMinutes}
                onChange={e => setSilenceMinutes(Number(e.target.value))}
                className="w-full accent-rose-500"
              />
            </div>
            <label className="sm:col-span-3 flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={aiAnalysis}
                onChange={e => setAiAnalysis(e.target.checked)}
                className="accent-indigo-600"
              />
              Analisi AI degli snapshot (riconoscimento scena/persona sull'hub, se configurata)
            </label>
          </div>
        </div>

        {/* Colonna 3: log eventi */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs h-fit max-h-[80vh] overflow-y-auto">
          <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-3">
            <Bell className="w-3.5 h-3.5 text-rose-500" />
            Eventi Rilevati ({events.length})
          </h3>
          <div className="space-y-2">
            {events.map(evt => (
              <div key={evt.id} className="border border-slate-100 rounded-xl p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${eventBadge(evt.type)}`}
                  >
                    {evt.type.replace("_", " ")}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{evt.timestamp}</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  <span className="font-semibold">{evt.sourceLabel}:</span> {evt.detail}
                </p>
                {evt.snapshot && (
                  <img
                    src={evt.snapshot}
                    alt="snapshot evento"
                    className="rounded-lg border border-slate-200 w-full"
                  />
                )}
                {evt.serverAnalysis && (
                  <p className="text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg p-2">
                    <Eye className="w-3 h-3 inline mr-1" />
                    {evt.serverAnalysis}
                  </p>
                )}
              </div>
            ))}
            {events.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">
                Nessun evento — il sistema osserva in silenzio
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
