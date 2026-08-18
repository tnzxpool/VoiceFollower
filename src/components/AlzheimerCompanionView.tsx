import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Heart,
  Music,
  Coffee,
  Home,
  Sun,
  Moon,
  Clock,
  Sparkles,
  Camera,
  RotateCcw,
  CheckCircle2,
  HelpCircle,
  Smile
} from "lucide-react";
import { ChatMessage, BiographicalMemoryEntry, SpeakerVoiceProfile } from "../types";
import { speakText, stopSpeaking, createSpeechRecognizer } from "../utils/speech";
import { triggerHapticFeedback } from "../utils/haptics";

interface AlzheimerCompanionViewProps {
  onSendMessage: (text: string, imageBase64?: string) => Promise<void>;
  isLoading: boolean;
  messages: ChatMessage[];
  biographicalMemories: BiographicalMemoryEntry[];
  patientName?: string;
  volumeLevel?: number;
  isMicAllowed?: boolean;
  isCameraAllowed?: boolean;
  onOpenCaregiverMaster?: () => void;
  voiceProfile?: SpeakerVoiceProfile;
}

export const AlzheimerCompanionView: React.FC<AlzheimerCompanionViewProps> = ({
  onSendMessage,
  isLoading,
  messages,
  biographicalMemories,
  patientName = "Ospite",
  volumeLevel = 85,
  isMicAllowed = true,
  isCameraAllowed = true,
  onOpenCaregiverMaster,
  voiceProfile
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [currentCompanionResponse, setCurrentCompanionResponse] = useState<string>(
    `Ciao ${patientName}, buongiorno! Sono qui con te. È una bella giornata e sei a casa al sicuro. Come ti senti?`
  );
  const [isNightMode, setIsNightMode] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [activeAnchorCard, setActiveAnchorCard] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recognizerRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Time & Date Formatter in clear Italian
  const [currentTimeStr, setCurrentTimeStr] = useState("");
  const [currentDateStr, setCurrentDateStr] = useState("");

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      setCurrentTimeStr(`${hours}:${minutes}`);

      const days = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
      const months = [
        "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
        "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
      ];
      const dayName = days[now.getDay()];
      const monthName = months[now.getMonth()];
      const dayNum = now.getDate();
      const timeOfDay = now.getHours() < 12 ? "Mattina" : now.getHours() < 18 ? "Pomeriggio" : "Sera";
      setCurrentDateStr(`Oggi è ${dayName} ${dayNum} ${monthName} • È ${timeOfDay}`);
    };

    updateDateTime();
    const timer = setInterval(updateDateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  // Update latest companion response when messages arrive.
  // La voce usa il PROFILO REALE configurato in Voice Tuning Studio
  // (pitch, velocità, vocabolario fonetico), non parametri fissi.
  const isSpeakingRef = useRef(false);
  useEffect(() => {
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      // Il messaggio di benvenuto iniziale resta solo scritto: niente TTS
      // all'apertura (la voce sintetica a freddo spaventa e suona male).
      if (last.sender !== "user" && last.text && last.id !== "msg_init") {
        setCurrentCompanionResponse(last.text);
        // Pausa il riconoscimento mentre il companion parla (anti eco/feedback)
        isSpeakingRef.current = true;
        if (recognizerRef.current) {
          try { recognizerRef.current.stop(); } catch (_) {}
        }
        speakText(last.text, {
          language: voiceProfile?.language || "it-IT",
          profile: voiceProfile || {
            speakerName: patientName,
            language: "it-IT",
            pitch: 1.0,
            speakingRate: 0.95,
            formantResonance: "NATURAL",
            speechCadence: "BALANCED_TACTICAL",
            vadSensitivity: 0.75,
            silenceThresholdMs: 1200,
            noiseGateDb: -45,
            customVocabulary: [],
            responsePersona: "EMPATHIC_EXPLANATORY"
          }
        });
        // Riprendi l'ascolto ambient quando la sintesi termina
        const resumeCheck = setInterval(() => {
          if (!window.speechSynthesis.speaking) {
            clearInterval(resumeCheck);
            isSpeakingRef.current = false;
            if (recognizerRef.current && isMicAllowed) {
              try { recognizerRef.current.start(); } catch (_) {}
              setIsListening(true);
            }
          }
        }, 400);
      }
    }
  }, [messages, patientName, voiceProfile, isMicAllowed]);

  // ASCOLTO AMBIENT CONTINUO — nessun pulsante da premere.
  // Il riconoscimento parte da solo, si riavvia da solo quando il browser lo
  // interrompe, e si sospende solo mentre il companion sta parlando.
  useEffect(() => {
    if (!isMicAllowed) {
      setIsListening(false);
      return;
    }

    let disposed = false;

    try {
      const rec = createSpeechRecognizer({
        language: "it-IT",
        onResult: (text, isFinal) => {
          setTranscript(text);
          if (isFinal && text.trim().length > 1) {
            triggerHapticFeedback("CONFIRMATION_PULSE", 0.6, 120);
            onSendMessage(text);
            setTranscript("");
          }
        },
        onError: (err) => {
          // "no-speech" e "aborted" sono normali nell'ascolto continuo
          const code = err?.error || "";
          if (code !== "no-speech" && code !== "aborted") {
            console.warn("Speech recognition warning:", err);
          }
        }
      });

      if (rec) {
        // Auto-riavvio: il browser ferma il riconoscimento dopo pause lunghe
        rec.onend = () => {
          if (!disposed && !isSpeakingRef.current) {
            setTimeout(() => {
              if (!disposed && !isSpeakingRef.current) {
                try { rec.start(); } catch (_) {}
              }
            }, 300);
          }
        };
        recognizerRef.current = rec;
        try {
          rec.start();
          setIsListening(true);
        } catch (_) {}
      }
    } catch (e) {
      console.warn("Speech recognizer initialization note:", e);
    }

    return () => {
      disposed = true;
      if (recognizerRef.current) {
        try {
          recognizerRef.current.onend = null;
          recognizerRef.current.stop();
        } catch (_) {}
      }
      setIsListening(false);
    };
  }, [isMicAllowed, onSendMessage]);

  const handleQuickAnchor = (anchorPrompt: string, cardName: string) => {
    stopSpeaking();
    setActiveAnchorCard(cardName);
    triggerHapticFeedback("CONFIRMATION_PULSE", 0.7, 100);
    onSendMessage(anchorPrompt);
    setTimeout(() => setActiveAnchorCard(null), 3000);
  };

  const handlePlaySong = () => {
    const songPrompt = "Cantiamo insieme la mia canzone preferita Volare di Domenico Modugno, cantami le prime strofe con calma.";
    handleQuickAnchor(songPrompt, "song");
  };

  const handleWhoIsHere = () => {
    const famPrompt = "Chi c'è qui con me a casa adesso? Ricordami chi sono i miei cari e che sono al sicuro.";
    handleQuickAnchor(famPrompt, "family");
  };

  const handleWhatToDo = () => {
    const routinePrompt = "Cosa facciamo adesso di bello? Ricordami la nostra routine rilassante del pomeriggio e il tè.";
    handleQuickAnchor(routinePrompt, "routine");
  };

  const handleTellStory = () => {
    const storyPrompt = "Raccontami un bel ricordo della mia città e della gioventù, con dolcezza e serenità.";
    handleQuickAnchor(storyPrompt, "story");
  };

  return (
    <div
      id="alzheimer-companion-screen"
      className={`min-h-[calc(100vh-80px)] flex flex-col justify-between transition-colors duration-500 ${
        isNightMode ? "bg-slate-950 text-slate-100" : "bg-amber-50/40 text-slate-900"
      } p-4 md:p-8 select-none`}
    >
      {/* Top Header: Simple Big Clock & Reassurance */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-amber-200/60 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-700 border border-amber-300/60">
              <Sun className="w-8 h-8 text-amber-600 animate-pulse" />
            </div>
            <div>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900">
                {currentTimeStr || "17:30"}
              </h1>
              <p className="text-sm md:text-lg font-medium text-amber-900/80 mt-0.5">
                {currentDateStr || "Oggi è una bella giornata serena"}
              </p>
            </div>
          </div>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={() => setIsNightMode(!isNightMode)}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm flex items-center gap-2 border transition-all ${
              isNightMode
                ? "bg-indigo-900 text-indigo-100 border-indigo-700"
                : "bg-white text-slate-700 border-slate-200 shadow-xs hover:bg-slate-50"
            }`}
          >
            {isNightMode ? <Moon className="w-4 h-4 text-amber-300" /> : <Sun className="w-4 h-4 text-amber-500" />}
            <span>{isNightMode ? "Modalità Giorno" : "Luce Notturna (Nàna)"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              speakText(currentCompanionResponse, {
                language: "it-IT",
                profile: {
                  speakerName: patientName,
                  language: "it-IT",
                  pitch: 1.0,
                  speakingRate: 0.95,
                  formantResonance: "NATURAL",
                  speechCadence: "BALANCED_TACTICAL",
                  vadSensitivity: 0.75,
                  silenceThresholdMs: 1200,
                  noiseGateDb: -45,
                  customVocabulary: [],
                  responsePersona: "EMPATHIC_EXPLANATORY"
                }
              });
            }}
            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
            title="Riascolta voce"
          >
            <Volume2 className="w-5 h-5 text-indigo-600" />
          </button>
        </div>
      </header>

      {/* Center Stage: The Warm VoiceFollower Heart & Response Card */}
      <main className="my-auto py-6 max-w-4xl mx-auto w-full flex flex-col items-center text-center space-y-6">
        {/* Animated Companion Orb / Presence */}
        <div className="relative flex items-center justify-center">
          {/* Subtle warm breathing aura */}
          <div
            className={`absolute w-36 h-36 md:w-48 md:h-48 rounded-full transition-all duration-700 ${
              isListening
                ? "bg-rose-400/30 scale-125 animate-ping"
                : isLoading
                ? "bg-amber-400/30 scale-110 animate-pulse"
                : "bg-indigo-400/20 scale-100"
            }`}
          />
          
          {/* Presenza del companion — NON è un pulsante: l'ascolto è sempre
              attivo in automatico, nessuna azione richiesta alla persona */}
          <div
            id="companion-presence-orb"
            aria-hidden="true"
            className={`relative z-10 w-28 h-28 md:w-36 md:h-36 rounded-full flex flex-col items-center justify-center shadow-xl border-4 transition-transform ${
              isLoading
                ? "bg-amber-500 border-amber-200 text-white"
                : isListening
                ? "bg-gradient-to-br from-indigo-600 to-indigo-800 border-white text-white"
                : "bg-slate-400 border-slate-200 text-white"
            }`}
          >
            {isLoading ? (
              <>
                <Sparkles className="w-10 h-10 md:w-14 md:h-14 animate-spin" />
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider mt-1">Penso...</span>
              </>
            ) : isListening ? (
              <>
                <Mic className="w-10 h-10 md:w-14 md:h-14" />
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider mt-1">Ti Ascolto Sempre</span>
              </>
            ) : (
              <>
                <MicOff className="w-10 h-10 md:w-14 md:h-14" />
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider mt-1">Microfono Spento</span>
              </>
            )}
          </div>
        </div>

        {/* Live speech transcription */}
        {transcript && (
          <div className="px-5 py-2.5 rounded-2xl bg-white/90 border border-indigo-200 text-indigo-950 text-base md:text-xl font-medium shadow-xs animate-fade-in">
            "{transcript}"
          </div>
        )}

        {/* Large, Legible Companion Spoken Response */}
        <div className="w-full bg-white rounded-3xl border-2 border-amber-200/80 p-6 md:p-8 shadow-sm text-left relative overflow-hidden">
          <div className="flex items-center gap-2 mb-3 text-amber-700 font-bold text-xs md:text-sm uppercase tracking-wide">
            <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
            <span>VoiceFollower ti risponde:</span>
          </div>

          <p className="text-xl md:text-3xl font-medium leading-relaxed text-slate-800 tracking-normal">
            {currentCompanionResponse}
          </p>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Sei a casa tua, tutto va bene e sei al sicuro.</span>
            </span>
            <button
              type="button"
              onClick={() =>
                speakText(currentCompanionResponse, {
                  language: "it-IT",
                  profile: {
                    speakerName: patientName,
                    language: "it-IT",
                    pitch: 1.0,
                    speakingRate: 0.95,
                    formantResonance: "NATURAL",
                    speechCadence: "BALANCED_TACTICAL",
                    vadSensitivity: 0.75,
                    silenceThresholdMs: 1200,
                    noiseGateDb: -45,
                    customVocabulary: [],
                    responsePersona: "EMPATHIC_EXPLANATORY"
                  }
                })
              }
              className="text-indigo-600 font-bold hover:underline flex items-center gap-1"
            >
              <Volume2 className="w-4 h-4" />
              <span>Riascolta a voce alta</span>
            </button>
          </div>
        </div>
      </main>

      {/* Bottom Section: 4 Big Heart Anchors for Immediate Comfort */}
      <footer className="space-y-4 pt-2">
        <div className="text-center text-xs md:text-sm font-bold uppercase tracking-wider text-slate-600">
          Cosa vorresti ricordare o fare adesso?
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-4xl mx-auto w-full">
          {/* 1. Chi c'è con me? */}
          <button
            type="button"
            id="anchor-family-btn"
            onClick={handleWhoIsHere}
            className={`p-4 md:p-5 rounded-2xl border-2 text-left transition-all shadow-xs flex flex-col justify-between ${
              activeAnchorCard === "family"
                ? "bg-rose-50 border-rose-400 scale-105"
                : "bg-white border-slate-200 hover:border-rose-300 hover:bg-rose-50/50"
            }`}
          >
            <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700 w-fit mb-2">
              <Heart className="w-6 h-6 fill-rose-500 text-rose-500" />
            </div>
            <div>
              <h3 className="font-extrabold text-base md:text-lg text-slate-900">Chi c'è con me?</h3>
              <p className="text-xs text-slate-500 mt-0.5">I tuoi cari e la tua famiglia</p>
            </div>
          </button>

          {/* 2. Ascoltiamo la musica del cuore */}
          <button
            type="button"
            id="anchor-song-btn"
            onClick={handlePlaySong}
            className={`p-4 md:p-5 rounded-2xl border-2 text-left transition-all shadow-xs flex flex-col justify-between ${
              activeAnchorCard === "song"
                ? "bg-indigo-50 border-indigo-400 scale-105"
                : "bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50"
            }`}
          >
            <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-700 w-fit mb-2">
              <Music className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-extrabold text-base md:text-lg text-slate-900">La mia Canzone</h3>
              <p className="text-xs text-slate-500 mt-0.5">"Volare" di Domenico Modugno</p>
            </div>
          </button>

          {/* 3. Cosa facciamo adesso? (Routine / Tè) */}
          <button
            type="button"
            id="anchor-routine-btn"
            onClick={handleWhatToDo}
            className={`p-4 md:p-5 rounded-2xl border-2 text-left transition-all shadow-xs flex flex-col justify-between ${
              activeAnchorCard === "routine"
                ? "bg-amber-50 border-amber-400 scale-105"
                : "bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/50"
            }`}
          >
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 w-fit mb-2">
              <Coffee className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="font-extrabold text-base md:text-lg text-slate-900">Cosa facciamo?</h3>
              <p className="text-xs text-slate-500 mt-0.5">Il tè caldo delle 16:30</p>
            </div>
          </button>

          {/* 4. Raccontami una bella storia */}
          <button
            type="button"
            id="anchor-story-btn"
            onClick={handleTellStory}
            className={`p-4 md:p-5 rounded-2xl border-2 text-left transition-all shadow-xs flex flex-col justify-between ${
              activeAnchorCard === "story"
                ? "bg-emerald-50 border-emerald-400 scale-105"
                : "bg-white border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50"
            }`}
          >
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 w-fit mb-2">
              <Smile className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-extrabold text-base md:text-lg text-slate-900">Una Bella Storia</h3>
              <p className="text-xs text-slate-500 mt-0.5">Ricordi di gioventù e Firenze</p>
            </div>
          </button>
        </div>

        {/* Caregiver Access Link (Small & Discreet at the bottom) */}
        {onOpenCaregiverMaster && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={onOpenCaregiverMaster}
              className="text-xs text-slate-400 hover:text-slate-700 underline transition-colors"
            >
              Apri Cruscotto Caregiver & Master Hub (Gestione LAN e Server)
            </button>
          </div>
        )}
      </footer>
    </div>
  );
};
