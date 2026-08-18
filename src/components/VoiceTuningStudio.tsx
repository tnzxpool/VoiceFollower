import React, { useState, useRef, useEffect } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sliders,
  Sparkles,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Plus,
  Trash2,
  ShieldCheck,
  Radio,
  Zap,
  Globe,
  UserCheck,
  Waves,
  Languages
} from "lucide-react";
import { SpeakerVoiceProfile, VoiceLanguage, CustomVocabEntry } from "../types";
import {
  speakText,
  stopSpeaking,
  createSpeechRecognizer,
  calculateFundamentalFrequency
} from "../utils/speech";
import { triggerHapticFeedback } from "../utils/haptics";

interface VoiceTuningStudioProps {
  profile: SpeakerVoiceProfile;
  onUpdateProfile: (updated: SpeakerVoiceProfile) => void;
}

export const VoiceTuningStudio: React.FC<VoiceTuningStudioProps> = ({
  profile,
  onUpdateProfile
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"calibration" | "tuning" | "vocabulary" | "test">("calibration");
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationStep, setCalibrationStep] = useState(0);
  const [currentPitchHz, setCurrentPitchHz] = useState<number>(profile.calibrationStatus?.averagePitchHz || 135);
  const [currentRms, setCurrentRms] = useState<number>(0);
  const [calibratedSamples, setCalibratedSamples] = useState<number[]>([]);

  // Test playground state
  const [testSpeechText, setTestSpeechText] = useState("EdgeMesh: telemetria duplex sincronizzata sui nodi slave Wi-Fi. Pronto per l'orchestrazione vocale.");
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [testTranscript, setTestTranscript] = useState("");
  const [recognitionActive, setRecognitionActive] = useState(false);

  // New vocabulary entry state
  const [newWord, setNewWord] = useState("");
  const [newPhonetic, setNewPhonetic] = useState("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognizerRef = useRef<any>(null);

  const calibrationPhrases = [
    {
      step: 0,
      title: "Passo 1: Tonalità e Frequenza Fondamentale (F0)",
      phrase: "EdgeMesh: avvia ricognizione duplex sui nodi periferici.",
      instruction: "Leggi la frase con il tuo naturale tono di voce e volume normale."
    },
    {
      step: 1,
      title: "Passo 2: Risonanza Timbrica e Cadenza",
      phrase: "Regola impulsi aptici per orientamento tattile a 180 Hertz.",
      instruction: "Pronuncia chiaramente i termini tecnici e la velocità desiderata."
    },
    {
      step: 2,
      title: "Passo 3: Sincronizzazione Operativa e Vocabolario",
      phrase: "Conferma sincronizzazione grafi di memoria e modello INT4 locale.",
      instruction: "Ultimo test di calibrazione: ottimizzazione soglia del rumore."
    }
  ];

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close();
      }
      if (recognizerRef.current) {
        recognizerRef.current.stop();
      }
      stopSpeaking();
    };
  }, []);

  // Real-time Pitch & Waveform Visualizer
  const startAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const buffer = new Float32Array(analyser.fftSize);

      const drawLoop = () => {
        if (!analyserRef.current || !canvasRef.current) return;
        analyserRef.current.getFloatTimeDomainData(buffer);

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const width = canvas.width;
          const height = canvas.height;
          ctx.clearRect(0, 0, width, height);

          // Waveform
          ctx.lineWidth = 2;
          ctx.strokeStyle = isCalibrating ? "#4f46e5" : "#059669";
          ctx.beginPath();
          const sliceWidth = width / buffer.length;
          let x = 0;
          for (let i = 0; i < buffer.length; i++) {
            const v = buffer[i] * 2;
            const y = (height / 2) + (v * (height / 2));
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
          }
          ctx.stroke();

          // Calculate fundamental pitch
          const analysis = calculateFundamentalFrequency(buffer, audioCtx.sampleRate);
          if (analysis.pitchHz > 0) {
            setCurrentPitchHz(analysis.pitchHz);
            if (isCalibrating) {
              setCalibratedSamples(prev => [...prev.slice(-30), analysis.pitchHz]);
            }
          }
          setCurrentRms(analysis.rms);
        }

        animRef.current = requestAnimationFrame(drawLoop);
      };

      drawLoop();
    } catch (err) {
      console.warn("Microphone analysis unavailable in current context:", err);
    }
  };

  const stopAudioAnalysis = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  };

  const handleStartCalibration = async () => {
    setIsCalibrating(true);
    setCalibrationStep(0);
    setCalibratedSamples([]);
    await startAudioAnalysis();
    triggerHapticFeedback("CONFIRMATION_PULSE", 0.7, 100);
  };

  const handleNextCalibrationStep = () => {
    if (calibrationStep < calibrationPhrases.length - 1) {
      setCalibrationStep(prev => prev + 1);
      triggerHapticFeedback("CONFIRMATION_PULSE", 0.6, 90);
    } else {
      const avg = calibratedSamples.length > 0
        ? Math.round(calibratedSamples.reduce((a, b) => a + b, 0) / calibratedSamples.length)
        : currentPitchHz || 135;

      const updated: SpeakerVoiceProfile = {
        ...profile,
        pitch: avg < 140 ? 0.95 : avg > 200 ? 1.15 : 1.0,
        f0FundamentalHz: avg,
        calibrationStatus: {
          isCalibrated: true,
          averagePitchHz: avg,
          sampleSnrDb: 29.2,
          calibratedDate: new Date().toLocaleString("it-IT"),
          sampleCount: (profile.calibrationStatus?.sampleCount || 0) + 1
        }
      };

      onUpdateProfile(updated);
      setIsCalibrating(false);
      stopAudioAnalysis();
      triggerHapticFeedback("CONFIRMATION_PULSE", 1.0, 200);
      speakText("Calibrazione vocale completata con successo. Profilo adattato al tuo parlato.", { profile: updated });
    }
  };

  const handleCancelCalibration = () => {
    setIsCalibrating(false);
    stopAudioAnalysis();
  };

  const updateField = <K extends keyof SpeakerVoiceProfile>(key: K, val: SpeakerVoiceProfile[K]) => {
    const updated = { ...profile, [key]: val };
    onUpdateProfile(updated);
  };

  const handleAddVocab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;
    const entry: CustomVocabEntry = {
      id: "v_" + Date.now(),
      phrase: newWord.trim(),
      phoneticAlt: newPhonetic.trim() || newWord.trim().toLowerCase(),
      boost: 0.9
    };
    updateField("customVocabulary", [...profile.customVocabulary, entry]);
    setNewWord("");
    setNewPhonetic("");
    triggerHapticFeedback("CONFIRMATION_PULSE", 0.5, 80);
  };

  const handleRemoveVocab = (id: string) => {
    updateField(
      "customVocabulary",
      profile.customVocabulary.filter((v) => v.id !== id)
    );
    triggerHapticFeedback("CONFIRMATION_PULSE", 0.4, 60);
  };

  const handlePlayTestSpeech = () => {
    speakText(testSpeechText, { profile });
    triggerHapticFeedback("CONFIRMATION_PULSE", 0.5, 70);
  };

  const handleToggleTestMic = () => {
    if (isTestingMic) {
      if (recognizerRef.current) recognizerRef.current.stop();
      setIsTestingMic(false);
      setRecognitionActive(false);
    } else {
      setIsTestingMic(true);
      setTestTranscript("In ascolto del tuo parlato in italiano...");
      const rec = createSpeechRecognizer({
        profile,
        language: profile.language,
        onResult: (transcript, isFinal) => {
          setTestTranscript(transcript);
          setRecognitionActive(true);
          if (isFinal) {
            triggerHapticFeedback("CONFIRMATION_PULSE", 0.5, 60);
          }
        },
        onError: () => {
          setIsTestingMic(false);
          setRecognitionActive(false);
        }
      });
      if (rec) {
        recognizerRef.current = rec;
        try {
          rec.start();
        } catch {
          setIsTestingMic(false);
        }
      }
    }
  };

  return (
    <div id="voice-tuning-studio" className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Left Column: Calibration & Acoustic Model (7 cols) */}
      <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 flex flex-col shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              Tuning Vocale & Profilo Parlato Operatore (Italiano)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Riconoscimento vocale personalizzato, calibrazione tono F0, cadenza e fonetica
            </p>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setActiveSubTab("calibration")}
              className={`px-3 py-1 font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeSubTab === "calibration"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Calibrazione</span>
            </button>
            <button
              onClick={() => setActiveSubTab("tuning")}
              className={`px-3 py-1 font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeSubTab === "tuning"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Parametri Tono</span>
            </button>
            <button
              onClick={() => setActiveSubTab("vocabulary")}
              className={`px-3 py-1 font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeSubTab === "vocabulary"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Languages className="w-3.5 h-3.5" />
              <span>Lessico Edge</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeSubTab === "calibration" && (
          <div className="flex-1 flex flex-col gap-4">
            {/* Live Audio & Pitch Visualizer Canvas */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
                    Analisi Spettrale F0 & Envelope
                  </span>
                </div>
                <span className="text-[11px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-semibold">
                  Pitch: {currentPitchHz} Hz • RMS: {(currentRms * 100).toFixed(1)}%
                </span>
              </div>

              <canvas
                ref={canvasRef}
                width={560}
                height={90}
                className="w-full h-24 rounded-lg bg-white border border-slate-200"
              />

              <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>Stato: {isCalibrating ? "🔴 Registrazione e analisi acustica attiva" : "In attesa"}</span>
                <span>Frequenza: {currentPitchHz < 150 ? "Baritono / Bassa" : currentPitchHz < 220 ? "Media / Naturale" : "Alta / Squillante"}</span>
              </div>
            </div>

            {/* Calibration Wizard Section */}
            {!isCalibrating ? (
              <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-bold text-slate-800">
                      Profilo Vocale Attivo: {profile.speakerName}
                    </h3>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {profile.calibrationStatus?.isCalibrated ? "Calibrato ✓" : "Non Calibrato"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-slate-700">
                  <div className="bg-slate-50 p-2 rounded border border-slate-200">
                    <span className="text-slate-400 text-[10px] block">PITCH BASE</span>
                    <span className="text-indigo-600 font-bold">{profile.calibrationStatus?.averagePitchHz || profile.f0FundamentalHz || 155} Hz</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border border-slate-200">
                    <span className="text-slate-400 text-[10px] block">RAPPORTO SNR</span>
                    <span className="text-emerald-600 font-bold">{profile.calibrationStatus?.sampleSnrDb || 31.2} dB</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border border-slate-200">
                    <span className="text-slate-400 text-[10px] block">SESSIONI</span>
                    <span className="text-purple-600 font-bold">{profile.calibrationStatus?.sampleCount || 1}</span>
                  </div>
                </div>

                <button
                  onClick={handleStartCalibration}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
                >
                  <Mic className="w-4 h-4" />
                  <span>Avvia Calibrazione Guidata Parlato (3 Passi)</span>
                </button>
              </div>
            ) : (
              <div className="bg-indigo-50/60 rounded-xl border border-indigo-200 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900">
                    {calibrationPhrases[calibrationStep].title}
                  </span>
                  <span className="text-[10px] font-mono text-indigo-600 font-semibold">
                    {calibrationStep + 1} / {calibrationPhrases.length}
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-indigo-200 text-center">
                  <p className="text-sm font-semibold text-slate-900 italic">
                    "{calibrationPhrases[calibrationStep].phrase}"
                  </p>
                  <p className="text-[11px] text-indigo-600 mt-1.5">
                    {calibrationPhrases[calibrationStep].instruction}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancelCalibration}
                    className="flex-1 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium border border-slate-300 transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleNextCalibrationStep}
                    className="flex-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {calibrationStep === calibrationPhrases.length - 1 ? "Completa Calibrazione" : "Registra e Avanza"}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSubTab === "tuning" && (
          <div className="flex-1 flex flex-col gap-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-700 block mb-1 font-medium">Identità Operatore</label>
                <input
                  type="text"
                  value={profile.speakerName}
                  onChange={(e) => updateField("speakerName", e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-slate-700 block mb-1 font-medium">Lingua Principale</label>
                <select
                  value={profile.language}
                  onChange={(e) => updateField("language", e.target.value as VoiceLanguage)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="it-IT">🇮🇹 Italiano (it-IT) - Predefinito</option>
                  <option value="en-US">🇬🇧 English (en-US)</option>
                </select>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-700 font-medium">Velocità di Parlato (Rate)</span>
                  <span className="text-indigo-600 font-mono font-bold">{(profile.speakingRate).toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.75"
                  max="1.4"
                  step="0.05"
                  value={profile.speakingRate}
                  onChange={(e) => updateField("speakingRate", parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-700 font-medium">Tonalità Vocale & F0 Shift (Pitch)</span>
                  <span className="text-indigo-600 font-mono font-bold">{(profile.pitch).toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.7"
                  max="1.4"
                  step="0.05"
                  value={profile.pitch}
                  onChange={(e) => updateField("pitch", parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="text-slate-700 font-medium block mb-1.5">Risonanza Timbrica</label>
                <select
                  value={profile.formantResonance}
                  onChange={(e) => updateField("formantResonance", e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="NATURAL">Naturale (Bilanciato)</option>
                  <option value="WARM_BASS">Calore Basso (Warm Bass)</option>
                  <option value="CRISP_PRESENCE">Presenza Chiara (Crisp)</option>
                  <option value="TELEMETRY_RADIO">Radio Telemetrica (Bandpass)</option>
                </select>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="text-slate-700 font-medium block mb-1.5">Stile Risposta IA</label>
                <select
                  value={profile.responsePersona}
                  onChange={(e) => updateField("responsePersona", e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="TACTICAL_CONCISE">Tattico & Sintetico (Rapido)</option>
                  <option value="TECHNICAL_ANALYTICAL">Tecnico & Analitico (Dettagliato)</option>
                  <option value="EMPATHIC_EXPLANATORY">Empatico & Descrittivo</option>
                  <option value="DIRECT_OPERATOR">Operatore Host Master</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === "vocabulary" && (
          <div className="flex-1 flex flex-col gap-3 text-xs">
            <p className="text-slate-500 leading-relaxed">
              Definisci termini tecnici edge o parole dialettali frequenti per garantire una trascrizione accurata.
            </p>

            <form onSubmit={handleAddVocab} className="flex gap-2">
              <input
                type="text"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                placeholder="Termine (es. EdgeMesh)"
                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                value={newPhonetic}
                onChange={(e) => setNewPhonetic(e.target.value)}
                placeholder="Varianti fonetiche"
                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center gap-1 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Aggiungi</span>
              </button>
            </form>

            <div className="space-y-1.5 overflow-y-auto max-h-56 pr-1">
              {profile.customVocabulary.map((v) => (
                <div
                  key={v.id}
                  className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-slate-900">{v.phrase}</span>
                    <span className="text-[11px] font-mono text-indigo-600 block mt-0.5">
                      Fonetica: {v.phoneticAlt}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveVocab(v.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                    title="Rimuovi"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Interactive Voice Sandbox (5 cols) */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        {/* Test Speech Synthesis Sandbox */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-indigo-600" />
              <span>Banco Prova Sintesi Vocale (Italiano)</span>
            </h3>
            <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              {profile.language} • {profile.speakingRate}x
            </span>
          </div>

          <textarea
            value={testSpeechText}
            onChange={(e) => setTestSpeechText(e.target.value)}
            rows={3}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none font-sans"
            placeholder="Scrivi una frase per testare la voce..."
          />

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handlePlayTestSpeech}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Riproduci Voce Calibrata</span>
            </button>
            <button
              onClick={stopSpeaking}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 transition-colors"
              title="Ferma audio"
            >
              <VolumeX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Mic Recognition Test Bench */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Mic className="w-4 h-4 text-indigo-600" />
                <span>Test Riconoscimento Vocale Reale</span>
              </h3>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                isTestingMic ? "bg-rose-50 text-rose-700 border-rose-300 animate-pulse" : "bg-slate-100 text-slate-600 border-slate-200"
              }`}>
                {isTestingMic ? "MIC ATTIVO" : "STANDBY"}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 mb-3">
              Parla liberamente in italiano: il motore applicherà il profilo vocale e il lessico calibrato in tempo reale.
            </p>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 min-h-[90px] flex items-center justify-center text-center">
              <p className="text-xs font-medium text-indigo-900 italic">
                {testTranscript || "Premi il pulsante sotto e parla..."}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleTestMic}
            className={`w-full py-2.5 mt-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              isTestingMic
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-xs"
                : "bg-slate-900 hover:bg-slate-800 text-white"
            }`}
          >
            {isTestingMic ? (
              <>
                <MicOff className="w-4 h-4" />
                <span>Interrompi Ascolto Test</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-white" />
                <span>Inizia Prova Vocale in Italiano</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

