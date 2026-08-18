import React, { useState, useEffect, useRef } from "react";
import { 
  Mic, 
  MicOff, 
  Send, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  ShieldCheck, 
  Wifi, 
  Waves, 
  Play, 
  CheckCircle2, 
  Smartphone, 
  Watch, 
  Layers,
  Radio,
  SlidersHorizontal,
  Flame,
  Moon,
  Compass,
  Heart,
  Home,
  LogOut,
  Tv,
  Coffee,
  Bed,
  Cpu,
  Trees,
  Sliders,
  Thermometer,
  Zap,
  Activity,
  Server
} from "lucide-react";
import { ChatMessage, HapticAction, SpeakerVoiceProfile, HomeScenario, HomeRoom, TTSEngineType } from "../types";
import { triggerHapticFeedback } from "../utils/haptics";
import { speakText, playNeuralVoiceChime } from "../utils/speech";

interface Props {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  isLoading: boolean;
  latestHaptic: HapticAction | null;
  profile: SpeakerVoiceProfile;
  onSwitchToAdmin: () => void;
}

export const HomeUserView: React.FC<Props> = ({
  messages,
  onSendMessage,
  isLoading,
  latestHaptic,
  profile,
  onSwitchToAdmin
}) => {
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechSynthesisEnabled, setSpeechSynthesisEnabled] = useState(true);
  const [selectedTtsEngine, setSelectedTtsEngine] = useState<TTSEngineType>("KOKORO_82M_NEURAL");
  const [activeTabSection, setActiveTabSection] = useState<"SCENARI" | "STANZE" | "DISPOSITIVI">("SCENARI");
  
  // BTicino MyHome Scenarios and Rooms State
  const [scenarios, setScenarios] = useState<HomeScenario[]>([
    {
      id: "scen_enter",
      name: "Entro a Casa",
      code: "WELCOME_HOME",
      icon: "Home",
      description: "Disarma perimetro, accende luci ingresso graduali e attiva assistente vocale.",
      category: "RAPIDO",
      active: true,
      hapticFeedbackPattern: "CONFIRMATION_PULSE",
      associatedSpokenFeedback: "Bentornato a casa. Sistema attivo, temperatura a 21 gradi e perimetro sicuro.",
      voiceStyle: "NATURAL_WARM"
    },
    {
      id: "scen_exit",
      name: "Esco di Casa",
      code: "AWAY_MODE",
      icon: "LogOut",
      description: "Spegne tutte le luci, abbassa tapparelle, attiva monitor perimetrale e scudo mesh.",
      category: "SICUREZZA",
      active: false,
      hapticFeedbackPattern: "ATTENTION_WARNING",
      associatedSpokenFeedback: "Modalità uscita inserita. Tutte le luci spente e scudo di sicurezza attivo.",
      voiceStyle: "TACTICAL_WHISPER"
    },
    {
      id: "scen_nana",
      name: "Notte / Nàna",
      code: "SLEEP_NANA",
      icon: "Moon",
      description: "Luce notturna soffusa 5%, audio a volume sussurrato, standby periferiche radio.",
      category: "NOTTE",
      active: false,
      hapticFeedbackPattern: "HEARTBEAT_RHYTHM",
      associatedSpokenFeedback: "Modalità nàna attivata. Riposo notturno impostato e notifiche silenziate.",
      voiceStyle: "TACTICAL_WHISPER"
    },
    {
      id: "scen_relax",
      name: "Relax & Living",
      code: "LOUNGE_COMFORT",
      icon: "Sparkles",
      description: "Temperatura comfort 21.5°C, luce calda 2700K diffusa, telemetria relax sullo smartwatch.",
      category: "COMFORT",
      active: false,
      hapticFeedbackPattern: "CONFIRMATION_PULSE",
      associatedSpokenFeedback: "Scenario relax avviato. Clima e luci calibrati per il massimo comfort.",
      voiceStyle: "NATURAL_WARM"
    },
    {
      id: "scen_bada",
      name: "Allarme / Bada Lì",
      code: "SECURITY_ALERT",
      icon: "Flame",
      description: "Scansione immediata varchi, flash visivo di segnalazione e vibrazione slave.",
      category: "SICUREZZA",
      active: false,
      hapticFeedbackPattern: "ATTENTION_WARNING",
      associatedSpokenFeedback: "Bada lì! Allarme di attenzione prioritario inviato a tutti i terminali slave.",
      voiceStyle: "ENERGETIC"
    }
  ]);

  const [rooms, setRooms] = useState<HomeRoom[]>([
    { id: "room_living", name: "Zona Living", icon: "Tv", temperatureC: 21.4, humidityPct: 46, lightsActiveCount: 2, totalLightsCount: 4, activeSlaveDevice: "Realme GT 7 Pro (LAN)", statusText: "Comfort ottimale" },
    { id: "room_kitchen", name: "Cucina", icon: "Coffee", temperatureC: 20.8, humidityPct: 52, lightsActiveCount: 0, totalLightsCount: 3, activeSlaveDevice: "Microfono Pod Alpha", statusText: "Inattivo" },
    { id: "room_bedroom", name: "Camera Notte", icon: "Bed", temperatureC: 19.8, humidityPct: 48, lightsActiveCount: 0, totalLightsCount: 2, activeSlaveDevice: "Smartwatch Aptico 01", statusText: "Pronta per Nàna" },
    { id: "room_lab", name: "Laboratorio / Server", icon: "Cpu", temperatureC: 22.1, humidityPct: 40, lightsActiveCount: 3, totalLightsCount: 3, activeSlaveDevice: "GPU Server 192.168.1.88", statusText: "RTX 4080 (48°C)" },
    { id: "room_garden", name: "Giardino Esterno", icon: "Trees", temperatureC: 18.2, humidityPct: 62, lightsActiveCount: 1, totalLightsCount: 4, activeSlaveDevice: "Beacon Perimetrale", statusText: "Perimetro protetto" }
  ]);

  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Load scenarios from backend if available
  useEffect(() => {
    fetch("/api/home/scenarios")
      .then(res => res.json())
      .then(data => {
        if (data.scenarios) setScenarios(data.scenarios);
        if (data.rooms) setRooms(data.rooms);
      })
      .catch(() => {});
  }, []);

  // Italian Web Speech Recognition setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = profile.language || "it-IT";

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsListening(false);
        playNeuralVoiceChime("confirm");
        onSendMessage(transcript);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [profile.language]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Riconoscimento vocale non supportato dal browser. Puoi digitare il comando.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
      playNeuralVoiceChime("wake");
      triggerHapticFeedback("CONFIRMATION_PULSE", 0.6, 80);
    }
  };

  // Speak AI response in Italian using Neural TTS pipeline
  useEffect(() => {
    if (!speechSynthesisEnabled) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.sender !== "user" && lastMsg.text) {
      speakText(lastMsg.text, {
        profile,
        language: profile.language || "it-IT",
        engine: selectedTtsEngine
      });
    }
  }, [messages, speechSynthesisEnabled, profile, selectedTtsEngine]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  const handleScenarioClick = async (scenario: HomeScenario) => {
    // Optimistic state update
    setScenarios(prev => prev.map(s => ({ ...s, active: s.id === scenario.id })));
    triggerHapticFeedback(scenario.hapticFeedbackPattern, 0.75, 140);
    playNeuralVoiceChime("confirm");

    try {
      const res = await fetch("/api/home/scenarios/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: scenario.id })
      });
      const data = await res.json();
      if (data.spokenFeedback) {
        onSendMessage(`[Scenario BTicino ${scenario.name} Attivato]`);
      }
    } catch {
      onSendMessage(`Attiva scenario ${scenario.name}`);
    }
  };

  const renderScenarioIcon = (iconName: string) => {
    switch (iconName) {
      case "Home": return <Home className="w-5 h-5" />;
      case "LogOut": return <LogOut className="w-5 h-5" />;
      case "Moon": return <Moon className="w-5 h-5" />;
      case "Sparkles": return <Sparkles className="w-5 h-5" />;
      case "Flame": return <Flame className="w-5 h-5" />;
      default: return <Zap className="w-5 h-5" />;
    }
  };

  const renderRoomIcon = (iconName: string) => {
    switch (iconName) {
      case "Tv": return <Tv className="w-4 h-4 text-indigo-600" />;
      case "Coffee": return <Coffee className="w-4 h-4 text-amber-600" />;
      case "Bed": return <Bed className="w-4 h-4 text-purple-600" />;
      case "Cpu": return <Cpu className="w-4 h-4 text-emerald-600" />;
      case "Trees": return <Trees className="w-4 h-4 text-teal-600" />;
      default: return <Home className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div id="home-user-view" className="space-y-5">
      {/* BTicino Living Now Inspired Top Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Controllo Casa & Assistente Neurale • BTicino Living Ergonomics
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Interfaccia One-Touch a blocchi basculanti, sintesi vocale neurale HD e telemetria nodi slave in LAN.
          </p>
        </div>

        {/* Status Pills: Realme GT 7 Pro & GPU Server */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Smartphone Realme GT 7 Pro in LAN */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 shadow-2xs">
            <Smartphone className="w-4 h-4 text-indigo-600" />
            <div className="flex flex-col">
              <span className="font-semibold text-[11px] leading-tight">Realme GT 7 Pro</span>
              <span className="text-[9px] text-emerald-600 font-mono">LAN 192.168.1.45 • 12ms</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>

          {/* GPU Server 192.168.1.88 */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 shadow-2xs">
            <Server className="w-4 h-4 text-emerald-600" />
            <div className="flex flex-col">
              <span className="font-semibold text-[11px] leading-tight">GPU Server Host</span>
              <span className="text-[9px] text-indigo-600 font-mono">RTX 4080 (16GB VRAM)</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>

          {/* Smartwatch */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 shadow-2xs">
            <Watch className="w-4 h-4 text-purple-600" />
            <span className="font-semibold text-[11px]">Smartwatch Aptico</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>

          {/* Voice Mute Toggle */}
          <button
            onClick={() => setSpeechSynthesisEnabled(!speechSynthesisEnabled)}
            className={`p-2 rounded-xl border transition-colors ${
              speechSynthesisEnabled
                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                : "bg-slate-100 border-slate-200 text-slate-400"
            }`}
            title="Attiva/Disattiva Voce Sintetizzata"
          >
            {speechSynthesisEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* TTS Neural Selector & Quality Comparison Bar */}
      <div className="bg-linear-to-r from-indigo-50/80 via-purple-50/50 to-white rounded-2xl border border-indigo-100/80 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-900">
              Pipeline Vocale: {selectedTtsEngine === "KOKORO_82M_NEURAL" ? "Kokoro-82M Neurale (Hugging Face)" : selectedTtsEngine === "PIPER_VITS_ITALIAN" ? "Piper VITS Italiano HD" : "Web Speech Standard"}
            </div>
            <p className="text-[11px] text-slate-600">
              {selectedTtsEngine === "KOKORO_82M_NEURAL"
                ? "Modello neurale compatto 82M parametri con prosodia italiana calda, intonazione umana e zero artefatti robotici."
                : "Sintesi vocale ad alta definizione eseguita sull'Host centrale."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedTtsEngine("KOKORO_82M_NEURAL");
              speakText("Kokoro 82M attivo. Sintesi vocale neurale italiana ad alta fedeltà pronta.", { engine: "KOKORO_82M_NEURAL", profile });
            }}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all shadow-2xs ${
              selectedTtsEngine === "KOKORO_82M_NEURAL"
                ? "bg-indigo-600 text-white font-bold"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Kokoro-82M (HF)
          </button>

          <button
            onClick={() => {
              setSelectedTtsEngine("PIPER_VITS_ITALIAN");
              speakText("Piper VITS attivo. Motore a bassa latenza su server GPU.", { engine: "PIPER_VITS_ITALIAN", profile });
            }}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all shadow-2xs ${
              selectedTtsEngine === "PIPER_VITS_ITALIAN"
                ? "bg-indigo-600 text-white font-bold"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Piper VITS
          </button>

          <button
            onClick={() => {
              setSelectedTtsEngine("WEB_SPEECH_LEGACY");
              speakText("Web Speech attivo.", { engine: "WEB_SPEECH_LEGACY", profile });
            }}
            className={`px-2.5 py-1.5 rounded-xl font-medium transition-all text-[11px] ${
              selectedTtsEngine === "WEB_SPEECH_LEGACY"
                ? "bg-slate-800 text-white"
                : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            Legacy Web
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs (BTicino Philosophy: Scenari, Stanze, Nodi LAN) */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTabSection("SCENARI")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTabSection === "SCENARI"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Scenari One-Touch (Living Now)
        </button>

        <button
          onClick={() => setActiveTabSection("STANZE")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTabSection === "STANZE"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Ambienti & Stanze ({rooms.length})
        </button>

        <button
          onClick={() => setActiveTabSection("DISPOSITIVI")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTabSection === "DISPOSITIVI"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Nodi Slave & Realme GT 7 Pro
        </button>
      </div>

      {/* Section 1: BTicino One-Touch Scenarios Matrix */}
      {activeTabSection === "SCENARI" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {scenarios.map(scenario => {
            const isActive = scenario.active;
            return (
              <button
                key={scenario.id}
                onClick={() => handleScenarioClick(scenario)}
                className={`p-4 rounded-2xl text-left transition-all duration-200 shadow-xs border flex flex-col justify-between min-h-[135px] relative group overflow-hidden ${
                  isActive
                    ? "bg-slate-900 text-white border-slate-900 ring-2 ring-indigo-500/50 shadow-md"
                    : "bg-white text-slate-900 border-slate-200 hover:border-indigo-300 hover:bg-slate-50/80"
                }`}
              >
                {/* Active LED Glow Indicator (BTicino Full-Cover style) */}
                <div className="flex items-center justify-between w-full mb-2">
                  <div className={`p-2.5 rounded-xl transition-colors ${
                    isActive ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 group-hover:bg-indigo-50 group-hover:text-indigo-600"
                  }`}>
                    {renderScenarioIcon(scenario.icon)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-400 shadow-xs" : "bg-slate-300"}`} />
                    <span className={`text-[10px] font-bold font-mono uppercase ${isActive ? "text-slate-300" : "text-slate-400"}`}>
                      {isActive ? "Attivo" : "Pronto"}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-bold leading-tight">{scenario.name}</div>
                  <p className={`text-[11px] mt-1 leading-snug line-clamp-2 ${isActive ? "text-slate-300" : "text-slate-500"}`}>
                    {scenario.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Section 2: Rooms & Environments */}
      {activeTabSection === "STANZE" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rooms.map(room => (
            <div key={room.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-slate-100">
                    {renderRoomIcon(room.icon)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{room.name}</h4>
                    <p className="text-[10px] text-slate-500">{room.activeSlaveDevice || "Nessun terminale"}</p>
                  </div>
                </div>
                <span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-bold text-slate-700 font-mono">
                  {room.lightsActiveCount}/{room.totalLightsCount} Luci
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Thermometer className="w-3.5 h-3.5 text-rose-500" />
                  <span className="font-mono font-bold text-slate-800">{room.temperatureC}°C</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600 justify-end">
                  <Activity className="w-3.5 h-3.5 text-blue-500" />
                  <span className="font-mono text-slate-700">{room.humidityPct}% UR</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Section 3: Slave Devices & Realme GT 7 Pro */}
      {activeTabSection === "DISPOSITIVI" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Realme GT 7 Pro Pod Card */}
          <div className="p-4 bg-white rounded-2xl border border-indigo-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <Smartphone className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">ONLINE</span>
            </div>
            <h4 className="text-xs font-bold text-slate-900">Realme GT 7 Pro (Slave A/V)</h4>
            <p className="text-[11px] text-slate-500">Snapdragon 8 Elite • O-Engine Haptic Motor • Display OLED</p>
            <div className="text-[10px] font-mono text-indigo-700 bg-indigo-50/60 p-2 rounded-lg">
              IP: 192.168.1.45 | Latenza: 12ms | Canale Wi-Fi 6
            </div>
            <button
              onClick={() => {
                triggerHapticFeedback("CONFIRMATION_PULSE", 0.9, 150);
                onSendMessage("Test vibrazione O-Engine inviato al Realme GT 7 Pro");
              }}
              className="w-full mt-2 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-2xs"
            >
              Test Vibrazione O-Engine
            </button>
          </div>

          {/* GPU Server 192.168.1.88 Card */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <Cpu className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">CUDA 12.4</span>
            </div>
            <h4 className="text-xs font-bold text-slate-900">Server GPU Neurale Host</h4>
            <p className="text-[11px] text-slate-500">NVIDIA RTX 4080 (16GB VRAM) • Kokoro-82M & Ollama</p>
            <div className="text-[10px] font-mono text-slate-700 bg-slate-50 p-2 rounded-lg">
              IP: 192.168.1.88:8000 | VRAM Usata: 5.62 / 16 GB
            </div>
            <button
              onClick={() => {
                speakText("Test del server GPU neurale a 192.168.1.88 completato con successo.", { engine: "KOKORO_82M_NEURAL", profile });
              }}
              className="w-full mt-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors shadow-2xs"
            >
              Test Sintesi Vocale GPU
            </button>
          </div>

          {/* Smartwatch Card */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <Watch className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">88% BATT</span>
            </div>
            <h4 className="text-xs font-bold text-slate-900">Smartwatch Aptico 01</h4>
            <p className="text-[11px] text-slate-500">Attuatore LRA 180Hz • Protocollo BLE-Mesh Cifrato</p>
            <div className="text-[10px] font-mono text-slate-700 bg-slate-50 p-2 rounded-lg">
              IP: 192.168.1.21 | Frequenza PDM: 48kHz
            </div>
            <button
              onClick={() => {
                triggerHapticFeedback("HEARTBEAT_RHYTHM", 0.7, 200);
                onSendMessage("Test battito cardiaco aptico inviato allo smartwatch");
              }}
              className="w-full mt-2 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors shadow-2xs"
            >
              Test Battito Aptico
            </button>
          </div>
        </div>
      )}

      {/* Main Conversation Dialog Feed (Clean Duplex Stream) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col h-[440px]">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Flusso Duplex Host Master & Terminali Slave
            </span>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {selectedTtsEngine === "KOKORO_82M_NEURAL" ? "Kokoro-82M HD" : "Italiano (it-IT)"} • ChaCha20
          </span>
        </div>

        {/* Message scroll container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map(msg => {
            const isUser = msg.sender === "user";
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-2xs ${
                    isUser
                      ? "bg-slate-900 text-white rounded-tr-xs"
                      : "bg-slate-100 text-slate-900 border border-slate-200/80 rounded-tl-xs"
                  }`}
                >
                  {!isUser && (
                    <div className="flex items-center gap-2 mb-1 text-[10px] text-indigo-600 font-bold uppercase tracking-wider">
                      <span>Host Master Neurale</span>
                      {msg.modelUsed && (
                        <span className="font-mono text-[9px] text-slate-500 font-normal">
                          • {msg.modelUsed}
                        </span>
                      )}
                    </div>
                  )}

                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* Haptic Action Pill */}
                  {msg.hapticAction && (
                    <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center gap-1.5 text-[11px] text-indigo-700 font-medium">
                      <Waves className="w-3.5 h-3.5 animate-pulse shrink-0" />
                      <span>Impulso Aptico: {msg.hapticAction.hapticDescription}</span>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 px-1 mt-1 font-mono">
                  {msg.timestamp}
                </span>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-start gap-2">
              <div className="bg-slate-100 rounded-2xl px-4 py-3 text-xs text-slate-500 border border-slate-200 rounded-tl-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.4s]" />
                <span className="ml-1 text-[11px]">Host Master in elaborazione neurale Kokoro...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input Field with Ergonomic Touch & Talk Button */}
        <form onSubmit={handleFormSubmit} className="p-3 border-t border-slate-100 flex items-center gap-2 bg-white rounded-b-2xl">
          <button
            type="button"
            onClick={toggleListening}
            className={`p-3.5 rounded-xl transition-all shadow-xs shrink-0 flex items-center gap-2 ${
              isListening
                ? "bg-rose-600 text-white animate-pulse"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            }`}
            title="Premi per parlare in italiano con sintesi neurale"
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            <span className="hidden sm:inline text-xs font-bold">
              {isListening ? "Ascolto..." : "Parla"}
            </span>
          </button>

          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder={isListening ? "In ascolto vocale (parla in italiano)..." : "Scrivi un comando o chiedi all'Host Master..."}
            className="flex-1 px-4 py-2.5 text-xs bg-slate-50 border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 rounded-xl text-slate-900"
          />

          <button
            type="submit"
            disabled={isLoading || !inputText.trim()}
            className="p-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-xl transition-colors shadow-xs shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Tip for Admin Mode */}
      <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="text-indigo-950">
          <span className="font-bold">Sei in modalità operatore BTicino MyHome.</span>
          <span className="text-indigo-800 ml-1">
            Per configurare il server GPU 192.168.1.88, le chiavi API o l'addestramento dialetti, apri la modalità Admin.
          </span>
        </div>
        <button
          onClick={onSwitchToAdmin}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shrink-0 shadow-xs"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Apri Modalità Admin</span>
        </button>
      </div>
    </div>
  );
};
