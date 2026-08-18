/**
 * Voice synthesis and recognition utilities for the Duplex Audio/Video Terminal
 * with full Italian (it-IT) language support, Neural HuggingFace TTS (Kokoro-82M / Piper VITS),
 * custom phonetic vocabulary tuning, and speaker pitch/cadence calibration.
 */
import { SpeakerVoiceProfile, VoiceLanguage, TTSEngineType } from "../types";

export const DEFAULT_SPEAKER_PROFILE: SpeakerVoiceProfile = {
  speakerName: "Operatore Mesh Primario",
  language: "it-IT",
  speakingRate: 0.98,
  pitch: 0.78, // voce maschile profonda (scelta nizix 2026-08-17; abbassato ancora: "troppo acuta")
  formantResonance: "NATURAL",
  speechCadence: "BALANCED_TACTICAL",
  vadSensitivity: 0.75,
  silenceThresholdMs: 1200,
  noiseGateDb: -45,
  customVocabulary: [
    { id: "v1", phrase: "EdgeMesh", phoneticAlt: "eg mesh, edge mesh, edgmesh", boost: 1.0 },
    { id: "v2", phrase: "INT4", phoneticAlt: "int 4, int quattro, in t 4", boost: 0.9 },
    { id: "v3", phrase: "NPU", phoneticAlt: "n p u, npu, ene pi u", boost: 0.9 },
    { id: "v4", phrase: "TDMA", phoneticAlt: "ti di emme a, tdma", boost: 0.8 },
    { id: "v5", phrase: "ChaCha20", phoneticAlt: "ciacia 20, chacha20, chacha 20", boost: 0.85 },
    { id: "v6", phrase: "aptico", phoneticAlt: "attico, aptico, aptici, haptic", boost: 0.95 },
    { id: "v7", phrase: "duplex", phoneticAlt: "duplecs, duplex, dupleks", boost: 0.85 },
    { id: "v8", phrase: "Kokoro", phoneticAlt: "cocoro, kokoro, co coro", boost: 0.95 },
    { id: "v9", phrase: "Bada lì", phoneticAlt: "badali, bada li, badalì", boost: 1.0 },
    { id: "v10", phrase: "Nàna", phoneticAlt: "nana, nanna, nàna", boost: 0.95 }
  ],
  responsePersona: "TACTICAL_CONCISE",
  calibrationStatus: {
    isCalibrated: true,
    averagePitchHz: 135,
    sampleSnrDb: 28.5,
    calibratedDate: "2026-08-15 15:40",
    sampleCount: 3
  }
};

let audioCtxInstance: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (!audioCtxInstance) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    audioCtxInstance = new AudioCtx();
  }
  if (audioCtxInstance.state === "suspended") {
    audioCtxInstance.resume();
  }
  return audioCtxInstance;
}

/**
 * Plays a high-definition neural voice chime and synthesizes Italian speech
 * with formant acoustic filtering for warm human presence (emulating Kokoro/Piper).
 */
export function playNeuralVoiceChime(type: "start" | "confirm" | "wake") {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === "wake") {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    } else if (type === "confirm") {
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    } else {
      osc.frequency.setValueAtTime(523.25, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    }

    osc.type = "sine";
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch {}
}

/**
 * High-definition Speech Synthesis with Engine Selection (Kokoro-82M, Piper, or Web Speech)
 */
export function speakText(
  text: string,
  options?: {
    profile?: SpeakerVoiceProfile;
    language?: VoiceLanguage;
    engine?: TTSEngineType;
    onEnd?: () => void;
  }
) {
  if (typeof window === "undefined") {
    if (options?.onEnd) options.onEnd();
    return;
  }

  const cleanText = text.replace(/[*_#`]/g, "").trim();
  const engine = options?.engine || "KOKORO_82M_NEURAL";
  const lang = options?.language || options?.profile?.language || "it-IT";
  const profile = options?.profile || DEFAULT_SPEAKER_PROFILE;

  // Ferma qualsiasi voce precedente (browser o server) e invalida richieste in volo
  stopSpeaking();
  const seq = speakSeq;

  // Tono di conferma: copre anche l'attesa (~1-3s) della sintesi sul server
  if (engine !== "WEB_SPEECH_LEGACY") {
    playNeuralVoiceChime("confirm");
  }

  const doSpeak = () => {
  if (!("speechSynthesis" in window)) {
    if (options?.onEnd) options.onEnd();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = profile.speakingRate || 1.02;
  utterance.pitch = profile.pitch || 1.0;
  utterance.lang = lang;

  // Pick natural voice
  const voices = window.speechSynthesis.getVoices();
  let preferredVoice: SpeechSynthesisVoice | undefined;

  if (lang.startsWith("it")) {
    const isIt = (v: SpeechSynthesisVoice) =>
      v.lang.startsWith("it") || v.lang.includes("it_IT") || v.lang.includes("it-IT");
    // Voce MASCHILE (scelta nizix): su Edge le neurali maschili it-IT sono Giuseppe e Diego.
    // Giuseppe è la più matura/profonda → viene prima. Cosimo è la maschile di sistema Windows.
    // Il pitch 0.78 del profilo scurisce solo le voci di sistema (le neurali lo ignorano).
    const male = ["Giuseppe", "Diego", "Cosimo", "Adriano"];
    const maleRank = (v: SpeechSynthesisVoice) => {
      const i = male.findIndex((n) => v.name.includes(n));
      return i === -1 ? 99 : i;
    };
    const isMale = (v: SpeechSynthesisVoice) => maleRank(v) < 99;
    const byRank = (a: SpeechSynthesisVoice, b: SpeechSynthesisVoice) => maleRank(a) - maleRank(b);
    // Ordine: neurale maschile (Giuseppe>Diego) > maschile qualsiasi > neurale > Google > qualsiasi italiana
    preferredVoice =
      voices.filter((v) => isIt(v) && v.name.includes("Online (Natural)") && isMale(v)).sort(byRank)[0] ||
      voices.filter((v) => isIt(v) && v.name.includes("Natural") && isMale(v)).sort(byRank)[0] ||
      voices.filter((v) => isIt(v) && isMale(v)).sort(byRank)[0] ||
      voices.find((v) => isIt(v) && v.name.includes("Online (Natural)")) ||
      voices.find((v) => isIt(v) && v.name.includes("Natural")) ||
      voices.find((v) => isIt(v) && v.name.includes("Google")) ||
      voices.find(isIt);
  } else {
    preferredVoice = voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Natural") ||
          v.name.includes("Google") ||
          v.name.includes("Samantha") ||
          v.name.includes("Daniel"))
    ) || voices.find((v) => v.lang.startsWith("en"));
  }

  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }
  lastVoiceName = preferredVoice ? preferredVoice.name : "(voce predefinita del sistema)";

  utterance.onend = () => {
    if (options?.onEnd) options.onEnd();
  };
  utterance.onerror = () => {
    if (options?.onEnd) options.onEnd();
  };

  window.speechSynthesis.speak(utterance);
  };

  // Voce del browser: al primo avvio l'elenco voci può non essere ancora caricato,
  // aspettare 'voiceschanged' evita che la prima frase esca con la voce di ripiego.
  const speakBrowser = () => {
    if (!("speechSynthesis" in window)) {
      if (options?.onEnd) options.onEnd();
      return;
    }
    if (window.speechSynthesis.getVoices().length === 0) {
      let done = false;
      const once = () => {
        if (done) return;
        done = true;
        window.speechSynthesis.removeEventListener("voiceschanged", once);
        doSpeak();
      };
      window.speechSynthesis.addEventListener("voiceschanged", once);
      setTimeout(once, 600); // fallback se l'evento non arriva
    } else {
      doSpeak();
    }
  };

  if (engine === "WEB_SPEECH_LEGACY") {
    speakBrowser();
    return;
  }

  // Voce VERA: vf-tts (XTTS-v2 sul P40) via /api/tts/speak.
  // Se il server non risponde si ripiega in silenzio sulla voce del browser.
  fetch("/api/tts/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: cleanText, language: lang.split("-")[0] })
  })
    .then(async (r) => {
      if (!r.ok) throw new Error(`vf-tts ${r.status}`);
      const blob = await r.blob();
      if (seq !== speakSeq) return; // superata da una frase più recente: non riprodurre
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;
      const gen = r.headers.get("X-Gen-Seconds");
      lastVoiceName = `XTTS-v2 su GPU P40${gen ? ` (${gen}s)` : ""}`;
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
        if (options?.onEnd) options.onEnd();
      };
      audio.onended = finish;
      audio.onerror = finish;
      return audio.play().catch(finish);
    })
    .catch(() => {
      if (seq !== speakSeq) return;
      speakBrowser();
    });
}

// Nome dell'ultima voce usata: mostrato nella barra kiosk per capire
// quale voce sta davvero parlando (debug "voce troppo acuta").
let lastVoiceName = "";
export function getLastVoiceName() {
  return lastVoiceName;
}

// Audio della voce server in riproduzione + contatore per invalidare
// le sintesi in volo quando arriva una frase nuova o uno stop.
let currentAudio: HTMLAudioElement | null = null;
let speakSeq = 0;

export function stopSpeaking() {
  speakSeq++;
  if (currentAudio) {
    try { currentAudio.pause(); } catch {}
    currentAudio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Applies speaker custom vocabulary dictionary to fix common misrecognitions
 */
export function applyPhoneticTuning(
  transcript: string,
  profile?: SpeakerVoiceProfile
): string {
  if (!transcript || !profile || !profile.customVocabulary) return transcript;

  let tuned = transcript;
  for (const entry of profile.customVocabulary) {
    if (!entry.phrase || !entry.phoneticAlt) continue;
    const alts = entry.phoneticAlt.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);
    for (const alt of alts) {
      if (!alt) continue;
      const regex = new RegExp(`\\b${alt}\\b`, "gi");
      tuned = tuned.replace(regex, entry.phrase);
    }
  }
  return tuned;
}

export function createSpeechRecognizer(options: {
  language?: VoiceLanguage;
  profile?: SpeakerVoiceProfile;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (err: any) => void;
}) {
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    return null;
  }

  const lang = options.language || options.profile?.language || "it-IT";

  try {
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        let transcript = event.results[i][0].transcript;
        transcript = applyPhoneticTuning(transcript, options.profile);
        if (event.results[i].isFinal) {
          options.onResult(transcript, true);
        } else {
          interim += transcript;
        }
      }
      if (interim) {
        options.onResult(interim, false);
      }
    };

    recognition.onerror = (e: any) => {
      options.onError(e);
    };

    return recognition;
  } catch (err) {
    options.onError(err);
    return null;
  }
}

/**
 * Autocorrelation algorithm to calculate estimated pitch (F0 in Hz) from time-domain audio data
 */
export function calculateFundamentalFrequency(
  buffer: Float32Array,
  sampleRate: number
): { pitchHz: number; confidence: number; rms: number } {
  const SIZE = buffer.length;
  let sumSquares = 0;
  for (let i = 0; i < SIZE; i++) {
    sumSquares += buffer[i] * buffer[i];
  }
  const rms = Math.sqrt(sumSquares / SIZE);
  if (rms < 0.01) {
    return { pitchHz: 0, confidence: 0, rms };
  }

  let r1 = 0;
  let r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) < thres) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buffer[SIZE - i]) < thres) {
      r2 = SIZE - i;
      break;
    }
  }

  const trimmed = buffer.slice(r1, r2);
  const c = new Float32Array(trimmed.length);
  for (let i = 0; i < trimmed.length; i++) {
    for (let j = 0; j < trimmed.length - i; j++) {
      c[i] = c[i] + trimmed[j] * trimmed[j + i];
    }
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < trimmed.length; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }

  let T0 = maxpos;
  const pitchHz = sampleRate / T0;
  const confidence = Math.min(1, maxval / c[0]);

  if (pitchHz >= 60 && pitchHz <= 600 && confidence > 0.4) {
    return { pitchHz: Math.round(pitchHz), confidence, rms };
  }

  return { pitchHz: 0, confidence: 0, rms };
}

