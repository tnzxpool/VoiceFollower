import React from "react";
import { 
  Radio, 
  Cpu, 
  Sparkles, 
  ShieldAlert, 
  Wifi, 
  BrainCircuit, 
  Network, 
  Waves, 
  Server, 
  Share2,
  Lock,
  Sliders,
  Languages,
  BookOpen,
  SlidersHorizontal,
  Home,
  FileCode,
  Heart,
  ShieldCheck,
  Smartphone,
  ScanEye
} from "lucide-react";
import { SpeakerVoiceProfile, OperationalViewMode } from "../types";

interface HeaderProps {
  viewMode: OperationalViewMode;
  setViewMode: (mode: OperationalViewMode) => void;
  adminTab: "dialects" | "config" | "terminal" | "voiceStudio" | "mesh" | "haptics" | "graph" | "microservices" | "extraction";
  setAdminTab: (tab: "dialects" | "config" | "terminal" | "voiceStudio" | "mesh" | "haptics" | "graph" | "microservices" | "extraction") => void;
  useHighThinking: boolean;
  setUseHighThinking: (val: boolean) => void;
  offlineMode: boolean;
  setOfflineMode: (val: boolean) => void;
  activeNodesCount: number;
  systemLatency: number;
  speakerProfile: SpeakerVoiceProfile;
  onUpdateProfile: (updated: SpeakerVoiceProfile) => void;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  setViewMode,
  adminTab,
  setAdminTab,
  useHighThinking,
  setUseHighThinking,
  offlineMode,
  setOfflineMode,
  activeNodesCount,
  systemLatency,
  speakerProfile,
  onUpdateProfile
}) => {
  return (
    <header id="app-header" className="border-b border-slate-200 bg-white text-slate-900 sticky top-0 z-40 shadow-xs">
      {/* Top Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Branding & Core Role */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 via-indigo-600 to-indigo-800 p-0.5 shadow-xs flex items-center justify-center text-white">
            <Heart className="w-5 h-5 fill-white text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
                VoiceFollower
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Server .88 Online
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Companion Alzheimer & Master Hub Caregiver • GPU Tesla P40 (24GB) • Host LAN .88
            </p>
          </div>
        </div>

        {/* Right: Operational View Switch & System Indicators */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          {/* Main Operational Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              onClick={() => setViewMode("COMPANION_ALZHEIMER")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                viewMode === "COMPANION_ALZHEIMER"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${viewMode === "COMPANION_ALZHEIMER" ? "fill-white text-white" : "text-rose-500"}`} />
              <span>Companion (Paziente)</span>
            </button>

            <button
              onClick={() => setViewMode("CAREGIVER_MASTER")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                viewMode === "CAREGIVER_MASTER"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Caregiver & LAN Hub</span>
            </button>

            <button
              onClick={() => setViewMode("SURVEILLANCE")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                viewMode === "SURVEILLANCE"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              <ScanEye className={`w-3.5 h-3.5 ${viewMode === "SURVEILLANCE" ? "text-white" : "text-emerald-600"}`} />
              <span>Sorveglianza</span>
            </button>

            <button
              onClick={() => setViewMode("ADVANCED_TRAINING")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold text-xs transition-all ${
                viewMode === "ADVANCED_TRAINING"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Admin / RAG</span>
            </button>
          </div>

          {/* Realme GT 7 Pro Status Indicator */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50/80 border border-emerald-200 text-emerald-900 font-mono text-[11px]">
            <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
            <span>GT 7 Pro: 192.168.1.45</span>
          </div>

          {/* High Thinking Toggle */}
          <button
            id="toggle-thinking-mode"
            onClick={() => setUseHighThinking(!useHighThinking)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-all border text-xs ${
              useHighThinking
                ? "bg-purple-50 text-purple-900 border-purple-300"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
            title="Ragionamento neurale approfondito"
          >
            <Sparkles className={`w-3.5 h-3.5 ${useHighThinking ? "text-purple-600 fill-purple-600" : "text-slate-400"}`} />
            <span className="hidden sm:inline">Ragionamento:</span>
            <span>{useHighThinking ? "Approfondito" : "Veloce"}</span>
          </button>

          {/* Offline Mode Switch */}
          <button
            id="toggle-offline-mode"
            onClick={() => setOfflineMode(!offlineMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-all border text-xs ${
              offlineMode
                ? "bg-amber-50 text-amber-900 border-amber-300"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
            title="Commutazione NPU Locale INT4 Air-Gap"
          >
            <ShieldAlert className={`w-3.5 h-3.5 ${offlineMode ? "text-amber-600" : "text-slate-400"}`} />
            <span>{offlineMode ? "Offline (INT4 NPU)" : "Cloud / Multi-LLM"}</span>
          </button>
        </div>
      </div>

      {/* Admin Secondary Tabs Navigation (Visible when in ADVANCED_TRAINING mode) */}
      {viewMode === "ADVANCED_TRAINING" && (
        <div className="border-t border-slate-100 bg-slate-50/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-1.5 scrollbar-none" aria-label="Admin Tabs">
              <button
                onClick={() => setAdminTab("dialects")}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  adminTab === "dialects"
                    ? "bg-white text-indigo-700 shadow-2xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>Addestramento Dialetti & Grafo</span>
              </button>

              <button
                onClick={() => setAdminTab("config")}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  adminTab === "config"
                    ? "bg-white text-indigo-700 shadow-2xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                <span>Motori Multi-LLM & API Keys</span>
              </button>

              <button
                onClick={() => setAdminTab("terminal")}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  adminTab === "terminal"
                    ? "bg-white text-indigo-700 shadow-2xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Radio className="w-3.5 h-3.5 text-indigo-600" />
                <span>Terminale Duplex Wi-Fi Master</span>
              </button>

              <button
                onClick={() => setAdminTab("voiceStudio")}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  adminTab === "voiceStudio"
                    ? "bg-white text-indigo-700 shadow-2xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                <span>Tuning Vocale Operatore</span>
              </button>

              <button
                onClick={() => setAdminTab("mesh")}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  adminTab === "mesh"
                    ? "bg-white text-indigo-700 shadow-2xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Network className="w-3.5 h-3.5 text-indigo-600" />
                <span>Topologia Slave Wi-Fi</span>
              </button>

              <button
                onClick={() => setAdminTab("graph")}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  adminTab === "graph"
                    ? "bg-white text-indigo-700 shadow-2xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Share2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Grafo Memoria & RAG</span>
              </button>

              <button
                onClick={() => setAdminTab("microservices")}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  adminTab === "microservices"
                    ? "bg-white text-indigo-700 shadow-2xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Server className="w-3.5 h-3.5 text-indigo-600" />
                <span>Microservizi Host</span>
              </button>

              <button
                onClick={() => setAdminTab("extraction")}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  adminTab === "extraction"
                    ? "bg-white text-emerald-800 shadow-2xs border border-emerald-200"
                    : "text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50"
                }`}
              >
                <FileCode className="w-3.5 h-3.5 text-emerald-600" />
                <span>Estrazione Host Locale & Backup</span>
              </button>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};


