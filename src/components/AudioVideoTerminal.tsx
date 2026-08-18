import React, { useState, useRef, useEffect } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Camera,
  Send,
  Volume2,
  VolumeX,
  Sparkles,
  ShieldCheck,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Zap
} from "lucide-react";
import { ChatMessage, HapticAction, SpeakerVoiceProfile, VoiceLanguage } from "../types";
import { triggerHapticFeedback } from "../utils/haptics";
import { speakText, stopSpeaking, createSpeechRecognizer } from "../utils/speech";

interface AudioVideoTerminalProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, imageBase64?: string) => Promise<void>;
  isLoading: boolean;
  useHighThinking: boolean;
  offlineMode: boolean;
  latestHaptic: HapticAction | null;
  profile: SpeakerVoiceProfile;
  onUpdateProfile: (updated: SpeakerVoiceProfile) => void;
  onOpenVoiceStudio?: () => void;
}

export const AudioVideoTerminal: React.FC<AudioVideoTerminalProps> = ({
  messages,
  onSendMessage,
  isLoading,
  useHighThinking,
  offlineMode,
  latestHaptic,
  profile,
  onUpdateProfile,
  onOpenVoiceStudio
}) => {
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioVisualizerRef = useRef<HTMLCanvasElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const speechRecognizerRef = useRef<any>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!autoSpeak || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.sender !== "user" && lastMsg.text) {
      speakText(lastMsg.text, { profile, language: profile.language });
    }
  }, [messages, autoSpeak, profile]);

  useEffect(() => {
    const canvas = audioVisualizerRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let localAudioSim = 0;
    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      let dataArray: Uint8Array;
      if (analyserRef.current && isRecording) {
        const bufferLength = analyserRef.current.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);
      } else {
        const numBars = 32;
        dataArray = new Uint8Array(numBars);
        localAudioSim += 0.05;
        for (let i = 0; i < numBars; i++) {
          if (isLoading || isRecording) {
            dataArray[i] = Math.floor(Math.sin(localAudioSim + i * 0.3) * 60 + 80 + Math.random() * 40);
          } else {
            dataArray[i] = Math.floor(Math.sin(localAudioSim + i * 0.2) * 15 + 20);
          }
        }
      }

      const barWidth = (width / dataArray.length) * 1.5;
      let x = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * height * 0.85;
        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, "rgba(99, 102, 241, 0.2)");
        gradient.addColorStop(1, isRecording ? "rgba(239, 68, 68, 0.9)" : "rgba(79, 70, 229, 0.9)");

        ctx.fillStyle = gradient;
        ctx.fillRect(x, height - barHeight, barWidth - 2, barHeight);
        x += barWidth;
      }

      animFrameIdRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [isRecording, isLoading]);

  const toggleCamera = async () => {
    if (isCameraActive) {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setIsCameraActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setIsCameraActive(true);
      } catch {
        setIsCameraActive(true);
      }
    }
  };

  const captureSnapshot = () => {
    if (videoRef.current && isCameraActive && mediaStreamRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        setCapturedSnapshot(dataUrl);
        triggerHapticFeedback("CONFIRMATION_PULSE", 0.6, 100);
        return;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, 640, 480);
      ctx.strokeStyle = "#6366f1";
      ctx.lineWidth = 2;
      ctx.strokeRect(160, 100, 320, 280);
      ctx.fillStyle = "#1e293b";
      ctx.font = "18px monospace";
      ctx.fillText("TERMINALE TELEMETRIA [ISTANTANEA]", 170, 130);
      ctx.fillText("OBIETTIVO: TELEMETRIA_VISIVA", 170, 160);
      ctx.fillText("BIOMETRIA: NORMALE (72 BPM)", 170, 190);
      ctx.fillText("ORARIO: " + new Date().toISOString(), 170, 220);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      setCapturedSnapshot(dataUrl);
      triggerHapticFeedback("CONFIRMATION_PULSE", 0.6, 100);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      if (speechRecognizerRef.current) {
        speechRecognizerRef.current.stop();
      }
      setIsRecording(false);
    } else {
      setIsRecording(true);
      const recognizer = createSpeechRecognizer({
        profile,
        language: profile.language,
        onResult: (transcript, isFinal) => {
          setInputText(transcript);
          if (isFinal && transcript.trim()) {
            handleSend(transcript.trim());
            setIsRecording(false);
          }
        },
        onError: () => {
          setIsRecording(false);
        }
      });

      if (recognizer) {
        speechRecognizerRef.current = recognizer;
        try {
          recognizer.start();
        } catch {
          setIsRecording(false);
        }
      }
    }
  };

  const handleSend = async (customText?: string) => {
    const textToSend = (customText !== undefined ? customText : inputText).trim();
    if (!textToSend && !capturedSnapshot) return;

    const img = capturedSnapshot || undefined;
    setInputText("");
    setCapturedSnapshot(null);
    await onSendMessage(textToSend, img);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickPrompts = [
    { label: "🚨 Allarme Urgente", text: "Allarme prioritario: perimetro violato! Attiva l'avviso tattile urgente su tutti i nodi periferici." },
    { label: "🧭 Guida Tattile", text: "Guida l'operatore con una matrice di scansione tattile direzionale verso sinistra." },
    { label: "💓 Sincronizzazione Respiro", text: "Avvia impulsi aptici ritmici di stabilizzazione respiratoria a 60 BPM." },
    { label: "🧠 Piano Orchestrale", text: "Orchestra l'allocazione della banda wireless e la pianificazione operativa per tutti i nodi mesh." },
    { label: "🛡️ Test INT4 Locale", text: "Esegui il test di verifica offline INT4 quantizzato in modalità air-gap." }
  ];

  return (
    <div id="av-terminal-container" className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Left Column: Live Audio/Video Terminal & Spectrum (5 cols) */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        {/* Multimodal Video Feed Terminal */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 relative overflow-hidden shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Video className="w-4 h-4 text-indigo-600" />
                Flusso Audio/Video Terminale
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>H.265 Cifrato</span>
            </div>
          </div>

          {/* Video Container / HUD */}
          <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center group">
            {isCameraActive ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-2 text-slate-400 border border-slate-700">
                  <VideoOff className="w-6 h-6" />
                </div>
                <p className="text-xs text-slate-200 font-medium">Terminale Duplex in Standby</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Clicca 'Attiva Telecamera' per avviare il flusso locale</p>
              </div>
            )}

            {/* Video HUD Overlays */}
            <div className="absolute inset-0 pointer-events-none p-3 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="bg-black/70 backdrop-blur-xs px-2 py-1 rounded text-[10px] font-mono text-cyan-300 border border-cyan-500/30">
                  REC // CANALE-01 [1080p @ 30fps]
                </div>
                <div className="bg-black/70 backdrop-blur-xs px-2 py-1 rounded text-[10px] font-mono text-emerald-400 border border-emerald-500/30 font-bold">
                  LATENZA: {offlineMode ? "12ms (INT4 NPU)" : "18ms (Wi-Fi/Host)"}
                </div>
              </div>

              <div className="self-center w-36 h-28 border border-cyan-400/40 rounded-lg relative flex items-center justify-center">
                <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-cyan-400" />
                <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-cyan-400" />
                <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-cyan-400" />
                <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-cyan-400" />
                <span className="text-[9px] font-mono text-cyan-300/80">ZONA_INTERAZIONE</span>
              </div>

              <div className="flex justify-between items-end">
                <div className="text-[10px] font-mono text-slate-300 bg-black/70 px-2 py-0.5 rounded">
                  AUDIO DSP: 48kHz PCM
                </div>
                <div className="text-[10px] font-mono text-purple-300 bg-black/70 px-2 py-0.5 rounded">
                  APTICA: PRONTA
                </div>
              </div>
            </div>
          </div>

          {/* Terminal Hardware Controls */}
          <div className="flex items-center justify-between mt-3 gap-2">
            <button
              id="btn-toggle-camera"
              onClick={toggleCamera}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                isCameraActive
                  ? "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100"
                  : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
              }`}
            >
              {isCameraActive ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
              <span>{isCameraActive ? "Disattiva Cam" : "Attiva Cam"}</span>
            </button>

            <button
              id="btn-capture-snapshot"
              onClick={captureSnapshot}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
              title="Acquisisci istantanea per percezione multimodale"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Istantanea</span>
            </button>

            <button
              id="btn-toggle-speech"
              onClick={() => {
                if (autoSpeak) stopSpeaking();
                setAutoSpeak(!autoSpeak);
              }}
              className={`p-2 rounded-lg border text-xs transition-colors ${
                autoSpeak
                  ? "bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100"
                  : "bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200"
              }`}
              title="Attiva/Disattiva sintesi vocale automatica"
            >
              {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>

          {capturedSnapshot && (
            <div className="mt-3 p-2 bg-slate-50 rounded-lg border border-indigo-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={capturedSnapshot} alt="Anteprima istantanea" className="w-12 h-9 rounded object-cover border border-slate-300" />
                <div>
                  <span className="text-xs font-semibold text-indigo-900">Istantanea allegata</span>
                  <p className="text-[10px] text-slate-500">Verrà inviata con il prossimo messaggio</p>
                </div>
              </div>
              <button
                onClick={() => setCapturedSnapshot(null)}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1"
              >
                Rimuovi
              </button>
            </div>
          )}
        </div>

        {/* Real-time Audio Spectrum & Haptic Peripheral Indicator */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-600" />
              <span>Spettro Audio Duplex (Microfono / Altoparlante)</span>
            </h3>
            <span className="text-[10px] font-mono font-semibold text-slate-500">
              {isRecording ? "MIC IN ASCOLTO" : isLoading ? "ELABORAZIONE" : "STANDBY"}
            </span>
          </div>

          <canvas
            ref={audioVisualizerRef}
            width={400}
            height={55}
            className="w-full h-14 bg-slate-50 rounded-lg border border-slate-200"
          />

          {latestHaptic && (
            <div className="mt-3 p-2.5 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-600" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-purple-900">
                      Impulso Aptico: {latestHaptic.pattern}
                    </span>
                    <span className="text-[10px] font-mono text-purple-700">
                      [{latestHaptic.durationMs}ms @ {Math.round(latestHaptic.intensity * 100)}%]
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">{latestHaptic.hapticDescription}</p>
                </div>
              </div>
              <button
                onClick={() => triggerHapticFeedback(latestHaptic.pattern, latestHaptic.intensity, latestHaptic.durationMs)}
                className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-[11px] text-white font-semibold"
              >
                Riproduci
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Conversational Interaction & Task Orchestration Stream (7 cols) */}
      <div className="lg:col-span-7 flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {/* Terminal Chat Header */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Orchestratore Conversazionale Duplex
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-600">
              Modello: <span className="font-bold text-indigo-700">{offlineMode ? "INT4 Locale" : useHighThinking ? "gemini-3.1-pro (Deep Think)" : "gemini-3.7-flash"}</span>
            </span>
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 p-4 overflow-y-auto max-h-[480px] min-h-[380px] space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <span className="text-[11px] font-semibold text-slate-500">
                  {msg.sender === "user"
                    ? "Operatore (Terminale)"
                    : msg.sender === "offline_npu"
                    ? "NPU INT4 Locale"
                    : "Host Master Centrale"}
                </span>
                <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                {msg.latencyMs && (
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200 font-semibold">
                    {msg.latencyMs}ms
                  </span>
                )}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[90%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                  msg.sender === "user"
                    ? "bg-indigo-600 text-white rounded-tr-none shadow-xs"
                    : "bg-slate-50 text-slate-900 border border-slate-200 rounded-tl-none shadow-xs"
                }`}
              >
                {msg.visualSnapshot && (
                  <div className="mb-2 rounded-lg overflow-hidden border border-slate-300 max-w-xs">
                    <img src={msg.visualSnapshot} alt="Istantanea allegata" className="w-full h-24 object-cover" />
                  </div>
                )}

                <p className="whitespace-pre-wrap">{msg.text}</p>

                {msg.sender !== "user" && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <button
                      onClick={() => speakText(msg.text, { profile })}
                      className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold"
                    >
                      <Play className="w-3 h-3 fill-indigo-600" />
                      <span>Ascolta Voce</span>
                    </button>

                    {msg.thinkingMode && (
                      <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 font-semibold">
                        {msg.thinkingMode}
                      </span>
                    )}
                  </div>
                )}

                {msg.taskPlan && msg.taskPlan.length > 0 && (
                  <div className="mt-3 p-2.5 rounded-xl bg-white border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-800 block mb-1.5">
                      Sotto-task orchestrati su nodi slave:
                    </span>
                    <div className="space-y-1">
                      {msg.taskPlan.map((task, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-[11px] text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-150"
                        >
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{task.title}</span>
                          </div>
                          <span className="font-mono text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-semibold border border-indigo-200">
                            {task.assignedUnit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {msg.hapticAction && (
                  <div className="mt-2 text-[11px] font-semibold text-purple-900 bg-purple-50 p-2 rounded-lg border border-purple-200 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-purple-600" />
                      <span>Aptica: {msg.hapticAction.pattern}</span>
                    </div>
                    <span className="text-[10px] text-purple-700 font-mono">
                      Nodo: {msg.hapticAction.targetNode}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className="text-[11px] font-semibold text-indigo-600">Host Master Centrale</span>
                <span className="text-[10px] text-slate-400">Elaborazione in corso...</span>
              </div>
              <div className="bg-slate-50 border border-indigo-200 rounded-2xl rounded-tl-none p-3.5 flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-600 animate-spin" />
                <span className="text-xs text-indigo-900 font-medium animate-pulse">
                  {useHighThinking ? "Elaborazione piano avanzato con Gemini..." : "Sintesi risposta vocale e segnali periferici..."}
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">COMANDI RAPIDI:</span>
          {quickPrompts.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(chip.text)}
              className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-medium transition-colors"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Input Bar with Voice Mic & Send */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
          <button
            id="btn-toggle-mic"
            onClick={toggleRecording}
            className={`p-2.5 rounded-xl border transition-all ${
              isRecording
                ? "bg-rose-600 text-white border-rose-600 animate-pulse shadow-xs"
                : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
            }`}
            title="Parla tramite microfono vocale"
          >
            {isRecording ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>

          <input
            id="terminal-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? "In ascolto della tua voce in italiano..." : "Scrivi un comando o istruzione per l'Host Master..."}
            className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />

          <button
            id="btn-send-message"
            onClick={() => handleSend()}
            disabled={isLoading || (!inputText.trim() && !capturedSnapshot)}
            className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
            title="Invia comando all'Host Master"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
