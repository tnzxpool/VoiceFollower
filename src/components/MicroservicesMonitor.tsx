import React, { useState } from "react";
import {
  Server,
  Cpu,
  HardDrive,
  Activity,
  ShieldCheck,
  RotateCcw,
  Play,
  Pause,
  Layers,
  Terminal,
  Zap,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { MicroserviceContainer } from "../types";
import { triggerHapticFeedback } from "../utils/haptics";

interface MicroservicesMonitorProps {
  containers: MicroserviceContainer[];
  offlineMode: boolean;
  onToggleContainer: (id: string, action: "restart" | "toggle") => void;
}

export const MicroservicesMonitor: React.FC<MicroservicesMonitorProps> = ({
  containers,
  offlineMode,
  onToggleContainer
}) => {
  const [logs, setLogs] = useState<string[]>([
    "[gateway] edge-duplex-gateway: in ascolto su 0.0.0.0:50051 (ChaCha20 TLS 1.3)",
    "[orchestratore] llm-orchestrator-core: caricato router multi-modello (Gemini / DeepSeek / GLM)",
    "[motore-rag] chroma-rag: indicizzate 4 specifiche di sistema, dim vettore 768",
    "[memoria-grafo] graph-memory-engine: pool di nodi inizializzato (7 nodi, 7 relazioni)",
    "[broker-aptico] haptic-dsp-broker: coda PDM in esecuzione a 48kHz",
    "[npu-quantizzata] int4-awq-engine: pesi AWQ 3.8B mappati su SRAM locale (1.4 GB)"
  ]);

  const handleRestart = (id: string) => {
    onToggleContainer(id, "restart");
    setLogs(prev => [
      `[sistema] Segnale di riavvio inviato al container ${id}`,
      ...prev.slice(0, 15)
    ]);
    triggerHapticFeedback("CONFIRMATION_PULSE", 0.6, 90);
  };

  return (
    <div id="microservices-monitor-view" className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Left Column: Containerized Microservices Pods (8 cols) */}
      <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-5 flex flex-col shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-600" />
              <span>Architettura Microservizi & Pod Host Master</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Container locali per streaming duplex, routing LLM, RAG e DSP aptico
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Pod Docker: Attivo</span>
          </span>
        </div>

        {/* Microservices Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {containers.map((svc) => (
            <div
              key={svc.id}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-between group"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${
                      svc.status === "running" ? "bg-emerald-500 animate-pulse" :
                      svc.status === "standby_ready" ? "bg-amber-500" : "bg-rose-500"
                    }`} />
                    <span className="text-xs font-bold text-slate-900">{svc.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 block mt-0.5">{svc.image}</span>
                </div>
                <span className="text-[10px] font-mono font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                  :{svc.port}
                </span>
              </div>

              {/* Resource Metrics */}
              <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono text-slate-600 my-2 pt-2 border-t border-slate-200">
                <div className="bg-white p-1.5 rounded border border-slate-200 shadow-2xs">
                  <span className="text-[9px] text-slate-500 block">CPU</span>
                  <span className="text-slate-900 font-semibold">{svc.cpu}</span>
                </div>
                <div className="bg-white p-1.5 rounded border border-slate-200 shadow-2xs">
                  <span className="text-[9px] text-slate-500 block">MEM</span>
                  <span className="text-slate-900 font-semibold">{svc.mem}</span>
                </div>
                <div className="bg-white p-1.5 rounded border border-slate-200 shadow-2xs">
                  <span className="text-[9px] text-slate-500 block">LATENZA</span>
                  <span className="text-emerald-700 font-semibold">{svc.latency}</span>
                </div>
              </div>

              {/* Container Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                <div className="flex items-center gap-1 text-[10px] font-mono text-slate-600">
                  <ShieldCheck className="w-3 h-3 text-indigo-600" />
                  <span>Cifratura mTLS</span>
                </div>
                <button
                  onClick={() => handleRestart(svc.id)}
                  className="px-2 py-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-[10px] text-slate-700 font-medium flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Riavvia</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Column: Local Quantized Model (INT4 AWQ) Engine & Container Terminal Logs (4 cols) */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        {/* Quantized Local Model Card */}
        <div className="bg-white rounded-2xl border border-amber-300 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-bold text-amber-900">NPU Neurale Quantizzata Locale</h3>
            </div>
            <span className="text-[10px] font-mono font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              INT4 AWQ
            </span>
          </div>

          <p className="text-[11px] text-slate-600 mb-3 leading-relaxed">
            Pesi quantizzati a 3.8B parametri (&lt;2GB) eseguiti nativamente su hardware host per funzionamento 100% offline e totale privacy dati.
          </p>

          <div className="space-y-2 text-xs font-mono">
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex justify-between">
              <span className="text-slate-600">Quantizzazione</span>
              <span className="text-amber-800 font-semibold">4-bit INT4 (AWQ Group 128)</span>
            </div>
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex justify-between">
              <span className="text-slate-600">VRAM / SRAM</span>
              <span className="text-slate-900 font-semibold">1.42 GB / 2.0 GB</span>
            </div>
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex justify-between">
              <span className="text-slate-600">Velocità Inferenza</span>
              <span className="text-emerald-700 font-bold">42.4 tok/s</span>
            </div>
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex justify-between">
              <span className="text-slate-600">Stato Air-Gap</span>
              <span className={offlineMode ? "text-amber-700 font-bold" : "text-slate-500"}>
                {offlineMode ? "ATTIVO (ISOLATO)" : "STANDBY"}
              </span>
            </div>
          </div>
        </div>

        {/* Microservices Container Console Logs */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex-1 flex flex-col shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-indigo-600" />
              <span>Log Console Microservizi (Stdout)</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-500">tail -n 20</span>
          </div>

          <div className="flex-1 bg-slate-900 rounded-xl p-3 border border-slate-800 font-mono text-[10px] text-slate-300 space-y-1.5 overflow-y-auto max-h-52">
            {logs.map((log, i) => (
              <div key={i} className="leading-tight">
                <span className="text-indigo-400">{log.split(" ")[0]}</span>{" "}
                <span className="text-slate-200">{log.split(" ").slice(1).join(" ")}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

