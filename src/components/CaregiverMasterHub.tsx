import React, { useState, useEffect, useRef } from "react";
import {
  Smartphone,
  Tablet,
  Watch,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Video,
  VideoOff,
  Sliders,
  Heart,
  UserCheck,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Server,
  Cpu,
  Database,
  Radio,
  Play,
  RotateCcw,
  Sparkles,
  ExternalLink
} from "lucide-react";
import {
  ClientSlaveSession,
  BiographicalMemoryEntry,
  CaregiverAlert,
  ProxmoxServerInfo,
  AdminConfig,
  KnowledgeGraphNode,
  KnowledgeGraphEdge
} from "../types";
import { KnowledgeGraphViewer } from "./KnowledgeGraphViewer";
import { triggerHapticFeedback } from "../utils/haptics";

interface CaregiverMasterHubProps {
  clients: ClientSlaveSession[];
  biographicalMemories: BiographicalMemoryEntry[];
  caregiverAlerts: CaregiverAlert[];
  proxmoxInfo: ProxmoxServerInfo;
  adminConfig: AdminConfig;
  graphData: { nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] };
  onUpdateClientPermission: (clientId: string, permissionKey: string, value: any) => Promise<void>;
  onUpdateClientVolume: (clientId: string, volumeLevel: number) => Promise<void>;
  onAddBiographicalMemory: (entry: Partial<BiographicalMemoryEntry>) => Promise<void>;
  onUpdateBiographicalMemory: (id: string, patch: Partial<BiographicalMemoryEntry>) => Promise<void>;
  onDeleteBiographicalMemory: (id: string) => Promise<void>;
  onResolveAlert: (alertId: string) => Promise<void>;
  onSwitchToCompanionView: () => void;
  onUpdateAdminConfig: (config: AdminConfig) => void;
}

export const CaregiverMasterHub: React.FC<CaregiverMasterHubProps> = ({
  clients,
  biographicalMemories,
  caregiverAlerts,
  proxmoxInfo,
  adminConfig,
  graphData,
  onUpdateClientPermission,
  onUpdateClientVolume,
  onAddBiographicalMemory,
  onUpdateBiographicalMemory,
  onDeleteBiographicalMemory,
  onResolveAlert,
  onSwitchToCompanionView,
  onUpdateAdminConfig
}) => {
  const [activeTab, setActiveTab] = useState<"devices" | "memories" | "alerts" | "server">("devices");

  // --- Filtri notifiche del diario (checkbox, persistiti nel browser) ---
  const ALERT_CATEGORIES: { key: string; label: string }[] = [
    { key: "movimento", label: "Movimento" },
    { key: "rumore", label: "Rumore forte" },
    { key: "silenzio", label: "Silenzio anomalo" },
    { key: "disorientamento", label: "Domande ripetute / disorientamento" },
    { key: "altro", label: "Altro" }
  ];
  const [alertFilters, setAlertFilters] = useState<Record<string, boolean>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("vf_alert_filters") || "{}");
      return { movimento: true, rumore: true, silenzio: true, disorientamento: true, altro: true, ...saved };
    } catch {
      return { movimento: true, rumore: true, silenzio: true, disorientamento: true, altro: true };
    }
  });
  const toggleAlertFilter = (key: string) => {
    setAlertFilters(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem("vf_alert_filters", JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const categorizeAlert = (a: CaregiverAlert): string => {
    const t = (a.title || "").toLowerCase();
    if (t.includes("movimento")) return "movimento";
    if (t.includes("rumore")) return "rumore";
    if (t.includes("silenzio")) return "silenzio";
    if (a.severity === "DISORIENTATION" || t.includes("ripetut") || t.includes("disorienta")) return "disorientamento";
    return "altro";
  };
  const visibleAlerts = caregiverAlerts.filter(a => alertFilters[categorizeAlert(a)] !== false);

  // Form state for adding biographical memory
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState<BiographicalMemoryEntry["category"]>("FAMILY_MEMBER");
  const [newValence, setNewValence] = useState<BiographicalMemoryEntry["emotionalValence"]>("ANCHOR");
  const [isAddingMemory, setIsAddingMemory] = useState(false);

  // Modifica inline di una memoria esistente (correzione dati sbagliati)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const startEdit = (mem: BiographicalMemoryEntry) => {
    setEditingId(mem.id);
    setEditTitle(mem.title);
    setEditDescription(mem.description);
  };
  const saveEdit = async () => {
    if (!editingId || !editTitle.trim() || !editDescription.trim()) return;
    await onUpdateBiographicalMemory(editingId, { title: editTitle.trim(), description: editDescription.trim() });
    setEditingId(null);
  };

  // Test inference state
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTestingInference, setIsTestingInference] = useState(false);

  const handleAddMemorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDescription) return;

    setIsAddingMemory(true);
    try {
      await onAddBiographicalMemory({
        title: newTitle,
        description: newDescription,
        category: newCategory,
        emotionalValence: newValence,
        relationOrTopic: newCategory === "FAMILY_MEMBER" ? "Familiare caro" : "Ricordo autobiografico"
      });
      setNewTitle("");
      setNewDescription("");
      triggerHapticFeedback("CONFIRMATION_PULSE", 0.7, 100);
    } finally {
      setIsAddingMemory(false);
    }
  };

  const handleTestP40Inference = async () => {
    setIsTestingInference(true);
    setTestResult("Interrogazione in corso del server Dell R740 con GPU Tesla P40 (24GB)...");
    try {
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Ciao, ricordami che sono a casa e dimmi che ore sono.",
          providerOverride: adminConfig.primaryProvider,
          useHighThinking: false
        })
      });
      const data = await res.json();
      setTestResult(
        `Risposta [Modello: ${data.modelUsed} • Latenza: ${data.latencyMs}ms]: "${data.spokenResponse}"`
      );
      triggerHapticFeedback("CONFIRMATION_PULSE", 0.8, 120);
    } catch (e: any) {
      setTestResult("Errore durante l'inferenza: " + e.message);
    } finally {
      setIsTestingInference(false);
    }
  };

  return (
    <div id="caregiver-master-hub" className="space-y-6">
      {/* Top Banner & Mode Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                VoiceFollower • Cruscotto Caregiver & Master Hub
              </h2>
              <p className="text-xs text-slate-500">
                Gestione dispositivi slave in LAN, permessi audio/video, memoria affettiva e server GPU locale Dell R740.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSwitchToCompanionView}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-transform active:scale-95"
          >
            <Heart className="w-4 h-4 fill-white" />
            <span>Passa a Vista Companion (Paziente)</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("devices")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
            activeTab === "devices"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Dispositivi LAN ({clients.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("memories")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
            activeTab === "memories"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Heart className="w-4 h-4" />
          <span>Memoria Biografica & Grafo ({biographicalMemories.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("alerts")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors relative ${
            activeTab === "alerts"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Diario Benessere & Alert</span>
          {caregiverAlerts.filter(a => !a.resolved).length > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute top-1 right-1" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("server")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
            activeTab === "server"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Server Dell R740 / P40 ({proxmoxInfo.ddnsDomain})</span>
        </button>
      </div>

      {/* TAB 1: DISPOSITIVI SLAVE IN LAN */}
      {activeTab === "devices" && (
        <div className="space-y-6">
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold">Controllo Autoritativo dei Dispositivi Slave in LAN</h4>
              <p className="mt-0.5 text-amber-800/90">
                Tutti i dispositivi connessi alla rete locale (smartphone Realme GT 7 Pro, tablet, microfoni ambientali)
                vengono riconosciuti automaticamente. L'amministratore/caregiver può abilitare la sessione autonoma, il microfono,
                l'altoparlante o la telecamera singolarmente per ciascun client.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {clients.map(client => {
              const isGt7Pro = client.id === "client_gt7pro";
              return (
                <div
                  key={client.id}
                  className={`bg-white rounded-2xl border-2 p-5 shadow-xs space-y-4 transition-all ${
                    client.autonomousSessionEnabled
                      ? "border-indigo-500/80 shadow-md ring-2 ring-indigo-100"
                      : "border-slate-200"
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-3 rounded-xl border ${
                          isGt7Pro
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {client.deviceType === "SMARTPHONE" ? (
                          <Smartphone className="w-6 h-6" />
                        ) : client.deviceType === "TABLET" ? (
                          <Tablet className="w-6 h-6" />
                        ) : (
                          <Watch className="w-6 h-6" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-sm text-slate-900">{client.name}</h3>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              client.status === "ONLINE"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {client.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                          IP: {client.ip} • Wi-Fi: {client.wifiSignalDbm} dBm • Batt: {client.batteryPct}%
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] font-medium text-slate-400">
                      {client.assignedRoom}
                    </span>
                  </div>

                  {/* Permissions & Controls Matrix */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-3">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Permessi di Comunicazione Abilitati dall'Admin</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {/* Sessione Autonoma Companion */}
                      <label className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
                        <span className="font-medium text-slate-800">Sessione Companion</span>
                        <input
                          type="checkbox"
                          checked={client.autonomousSessionEnabled}
                          onChange={e =>
                            onUpdateClientPermission(client.id, "autonomousSessionEnabled", e.target.checked)
                          }
                          className="w-4 h-4 text-indigo-600 rounded-sm focus:ring-indigo-500 cursor-pointer"
                        />
                      </label>

                      {/* Ascolto Microfono (Audio In) */}
                      <label className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
                        <span className="font-medium text-slate-800 flex items-center gap-1.5">
                          <Mic className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Ascolto Audio</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={client.audioStreamRxEnabled}
                          onChange={e =>
                            onUpdateClientPermission(client.id, "audioStreamRxEnabled", e.target.checked)
                          }
                          className="w-4 h-4 text-indigo-600 rounded-sm focus:ring-indigo-500 cursor-pointer"
                        />
                      </label>

                      {/* Altoparlante Voce (Audio Out) */}
                      <label className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
                        <span className="font-medium text-slate-800 flex items-center gap-1.5">
                          <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Parlato Neurale</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={client.audioStreamTxEnabled}
                          onChange={e =>
                            onUpdateClientPermission(client.id, "audioStreamTxEnabled", e.target.checked)
                          }
                          className="w-4 h-4 text-indigo-600 rounded-sm focus:ring-indigo-500 cursor-pointer"
                        />
                      </label>

                      {/* Telecamera Sicurezza & Orientamento (Video In) */}
                      <label className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
                        <span className="font-medium text-slate-800 flex items-center gap-1.5">
                          <Video className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Telecamera Visione</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={client.videoStreamRxEnabled}
                          onChange={e =>
                            onUpdateClientPermission(client.id, "videoStreamRxEnabled", e.target.checked)
                          }
                          className="w-4 h-4 text-indigo-600 rounded-sm focus:ring-indigo-500 cursor-pointer"
                        />
                      </label>
                    </div>

                    {/* Volume Slider */}
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-slate-700 flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Volume Altoparlante Remoto: {client.volumeLevel}%</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={client.volumeLevel}
                        onChange={e => onUpdateClientVolume(client.id, parseInt(e.target.value, 10))}
                        className="w-32 accent-indigo-600"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400">
                      Ultima attività: {client.lastActiveTime}
                    </span>

                    {client.autonomousSessionEnabled && (
                      <button
                        type="button"
                        onClick={onSwitchToCompanionView}
                        className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                        <span>Avvia Schermata Companion</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: MEMORIA BIOGRAFICA & GRAFO */}
      {activeTab === "memories" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  Memorie Affettive & Ancore del Cuore
                </h3>
                <p className="text-xs text-slate-500">
                  Il companion usa queste informazioni per rassicurare la persona, ricordare i nomi dei cari e riportare serenità.
                </p>
              </div>
            </div>

            {/* List of biographical memories */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {biographicalMemories.length === 0 && (
                <div className="col-span-full p-4 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
                  Nessuna memoria registrata. Il companion NON inventa nulla: finché non inserisci
                  qui i fatti veri (familiari, abitudini, luoghi), non nominerà nomi o parentele.
                </div>
              )}
              {biographicalMemories.map(mem => (
                <div
                  key={mem.id}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 flex flex-col justify-between"
                >
                  {editingId === mem.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-indigo-300 text-xs font-bold text-slate-900"
                      />
                      <textarea
                        value={editDescription}
                        onChange={e => setEditDescription(e.target.value)}
                        rows={3}
                        className="w-full px-2 py-1.5 rounded-lg border border-indigo-300 text-xs text-slate-900"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-bold"
                        >
                          Salva
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-700 text-[11px] font-bold"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                            {mem.category === "FAMILY_MEMBER"
                              ? "Familiare"
                              : mem.category === "HOMETOWN"
                              ? "Radici / Città"
                              : mem.category === "FAVORITE_SONG"
                              ? "Canzone del Cuore"
                              : "Abitudine"}
                          </span>
                          <span className="flex items-center gap-1">
                            <button
                              type="button"
                              title="Modifica (correggi informazioni sbagliate)"
                              onClick={() => startEdit(mem)}
                              className="p-1 rounded-sm hover:bg-indigo-100 text-indigo-600 text-[11px] font-bold"
                            >
                              Modifica
                            </button>
                            <button
                              type="button"
                              title="Elimina questa memoria"
                              onClick={() => { if (window.confirm(`Eliminare "${mem.title}"? Il companion non la userà più.`)) onDeleteBiographicalMemory(mem.id); }}
                              className="p-1 rounded-sm hover:bg-red-100 text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        </div>

                        <h4 className="font-bold text-sm text-slate-900">{mem.title}</h4>
                        <p className="text-xs text-slate-600 leading-relaxed mt-1">{mem.description}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Valenza: {mem.emotionalValence}</span>
                        <span>Ricordato {mem.frequencyTriggered} volte</span>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add Memory Form */}
            <form onSubmit={handleAddMemorySubmit} className="pt-4 border-t border-slate-200 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-indigo-600" />
                <span>Aggiungi Nuovo Familiare o Ricordo Importante</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Nome o Titolo Ricordo</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="Es. Maria (Moglie) o Casa al mare..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Categoria</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900"
                  >
                    <option value="FAMILY_MEMBER">Familiare / Persona Cara</option>
                    <option value="SPECIAL_MEMORY">Ricordo Felice di Vita</option>
                    <option value="FAVORITE_SONG">Canzone o Musica del Cuore</option>
                    <option value="COMFORT_ROUTINE">Abitudine / Routine di Conforto</option>
                    <option value="HOMETOWN">Luogo d'Infanzia / Radici</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Effetto Emotivo</label>
                  <select
                    value={newValence}
                    onChange={e => setNewValence(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900"
                  >
                    <option value="ANCHOR">Ancora di Sicurezza (Rassicura subito)</option>
                    <option value="CALMING">Calmante (Abbassa l'agitazione)</option>
                    <option value="JOY">Gioia / Sorriso (Stimola buonumore)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 text-xs mb-1">
                  Descrizione Calda e Dettagli da Ricordare
                </label>
                <textarea
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="Es. Sposati nel 1978 a Firenze. Ricordare i pranzi della domenica e il suo sorriso dolce..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isAddingMemory}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAddingMemory ? "Salvataggio..." : "Salva Memoria nel Grafo di Vita"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Knowledge Graph Component Viewer */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="font-extrabold text-sm text-slate-900">
              Grafo Semantico delle Relazioni & Conoscenze
            </h3>
            <p className="text-xs text-slate-500">
              Mappa visiva che connette ricordi, persone, dialetti e concetti appresi durante le conversazioni.
            </p>
            <div className="h-[400px]">
              <KnowledgeGraphViewer
                nodes={graphData.nodes}
                edges={graphData.edges}
                onSelectNode={() => {}}
              />
            </div>
          </div>

          {/* Cura quotidiana: novità di famiglia, prossima visita, promemoria,
              check-in proattivi (clone offline delle funzioni KindredMind) */}
          <PannelloCura />

          {/* Registrazione voce del caregiver per il futuro training TTS
              (clonazione vocale). Campioni in data/voice-training/, mai su GitHub. */}
          <RegistrazioneVoce />
        </div>
      )}

      {/* TAB 3: DIARIO DEL BENESSERE & ALERT */}
      {activeTab === "alerts" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  Diario degli Eventi & Segnalazioni Caregiver
                </h3>
                <p className="text-xs text-slate-500">
                  Monitoraggio intelligente delle domande ripetute, stati di disorientamento e momenti positivi.
                </p>
              </div>
            </div>

            {/* Info per il caregiver: come funziona il diario */}
            <div className="border border-sky-300 bg-sky-50 px-3 py-2 text-[11px] leading-relaxed text-slate-700">
              <b>Come funziona:</b> ogni allarme (movimento, rumore, silenzio anomalo) genera al massimo
              una segnalazione ogni 15 secondi per postazione — non è un guasto se durante un allarme
              continuo non arrivano segnalazioni a raffica. Le foto degli eventi restano al massimo 24 ore
              (ultime 10), poi vengono cancellate da sole: la riga scritta dell'evento resta.
              Le domande ripetute dalla persona vengono segnalate <b>solo qui</b>: il companion non gliele
              fa mai notare.
            </div>

            {/* Checkbox per abilitare/disabilitare i tipi di notifica */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 border border-slate-300 bg-slate-50 px-3 py-2">
              <span className="text-xs font-bold text-slate-700">Mostra:</span>
              {ALERT_CATEGORIES.map(cat => (
                <label key={cat.key} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={alertFilters[cat.key] !== false}
                    onChange={() => toggleAlertFilter(cat.key)}
                    className="w-3.5 h-3.5 accent-indigo-600"
                  />
                  {cat.label}
                </label>
              ))}
              <span className="ml-auto text-[11px] text-slate-400">
                {visibleAlerts.length} di {caregiverAlerts.length} eventi
              </span>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {visibleAlerts.length === 0 && (
                <p className="text-xs text-slate-400 py-6 text-center">
                  Nessun evento nelle categorie selezionate.
                </p>
              )}
              {visibleAlerts.map(alert => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-xl border flex items-start justify-between gap-4 transition-all ${
                    alert.severity === "ATTENTION"
                      ? "bg-amber-50/60 border-amber-300"
                      : alert.severity === "DISORIENTATION"
                      ? "bg-rose-50/60 border-rose-300"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        alert.severity === "ATTENTION"
                          ? "bg-amber-100 text-amber-800"
                          : alert.severity === "DISORIENTATION"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-indigo-100 text-indigo-800"
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-xs text-slate-900">{alert.title}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">{alert.timestamp}</span>
                        <span className="text-[10px] text-slate-500 font-medium">({alert.sourceDevice})</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{alert.description}</p>
                      {alert.detectedPhrase && (
                        <div className="mt-2 text-xs italic text-slate-700 bg-white/70 px-2.5 py-1 rounded-md border border-slate-200/60 w-fit">
                          Frase rilevata: "{alert.detectedPhrase}"
                        </div>
                      )}
                    </div>
                  </div>

                  {!alert.resolved ? (
                    <button
                      type="button"
                      onClick={() => onResolveAlert(alert.id)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold shrink-0"
                    >
                      Segna Risolto
                    </button>
                  ) : (
                    <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Gestito</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Diario mnemonico: avvistamenti oggetti (vf-vision), note memorizzate
              su ordine vocale, sveglia. Compatto: una riga per voce. */}
          <DiarioMnemonico />
        </div>
      )}

      {/* TAB 4: SERVER DELL R740 / P40 */}
      {activeTab === "server" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-900 text-white">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Server Host Master: {proxmoxInfo.serverModel}
                  </h3>
                  <p className="text-xs text-slate-500">
                    DDNS: <span className="font-mono font-bold text-indigo-600">{proxmoxInfo.ddnsDomain}</span> • LAN: <span className="font-mono font-bold text-slate-800">{proxmoxInfo.lanIp}</span>
                  </p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Proxmox VE Online</span>
              </span>
            </div>

            {/* Hardware & GPU Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 font-medium">GPU Neurale Dedicata</span>
                <p className="font-bold text-slate-900 text-sm">{proxmoxInfo.gpuModel}</p>
                <p className="text-[11px] text-slate-500">Accelerazione FP32 & INT4 Pascal</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 font-medium">VRAM Allocata</span>
                <p className="font-bold text-slate-900 text-sm">{proxmoxInfo.vramUsedGb} GB / {proxmoxInfo.vramTotalGb} GB (24GB)</p>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full"
                    style={{ width: `${(proxmoxInfo.vramUsedGb / proxmoxInfo.vramTotalGb) * 100}%` }}
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 font-medium">Modelli & Stack Attivi</span>
                <p className="font-bold text-slate-900">{proxmoxInfo.activeModel}</p>
                <p className="text-[11px] text-emerald-600 font-semibold">Kokoro-82M TTS + Whisper STT</p>
              </div>
            </div>

            {/* Test Inference Button */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleTestP40Inference}
                disabled={isTestingInference}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
              >
                <Cpu className="w-4 h-4 text-emerald-400" />
                <span>{isTestingInference ? "Inferenza in corso..." : "Esegui Test Inferenza LLM su Tesla P40"}</span>
              </button>

              <a
                href={`http://${proxmoxInfo.ddnsDomain}:3000`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1"
              >
                <span>Accedi a Web GUI Master ({proxmoxInfo.ddnsDomain})</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {testResult && (
              <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 text-xs font-mono">
                {testResult}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Diario mnemonico dell'applicazione: cosa hanno visto le telecamere (oggetti,
// vf-vision YOLO), cosa e' stato memorizzato su ordine vocale, stato sveglia.
// Compatto per scelta (nizix): una riga per voce, niente containers enormi.
function DiarioMnemonico() {
  const [entries, setEntries] = useState<any[]>([]);
  const [oggetti, setOggetti] = useState<Record<string, any>>({});
  const [sveglia, setSveglia] = useState<{ enabled: boolean; time: string }>({ enabled: false, time: "08:00" });

  const carica = () => {
    fetch("/api/diary").then(r => r.json()).then(d => {
      if (Array.isArray(d?.entries)) setEntries(d.entries.slice(0, 60));
      if (d?.alarm) setSveglia(d.alarm);
    }).catch(() => {});
    fetch("/api/objects").then(r => r.json()).then(d => {
      if (d?.objects) setOggetti(d.objects);
    }).catch(() => {});
  };
  useEffect(() => { carica(); const t = setInterval(carica, 30000); return () => clearInterval(t); }, []);

  const KIND_LABEL: Record<string, string> = {
    visione: "VISTO", memoria: "MEMORIA", nota: "NOTA", sveglia: "SVEGLIA", evento: "EVENTO"
  };
  const listaOggetti = Object.values(oggetti)
    .sort((a: any, b: any) => (b.lastSeen || "").localeCompare(a.lastSeen || ""));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-sm text-slate-900">Diario Mnemonico & Memoria Oggetti</h3>
          <p className="text-[11px] text-slate-500">
            Avvistamenti reali (YOLO locale, porta 9106), note memorizzate SOLO su ordine vocale, sveglia.
          </p>
        </div>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${sveglia.enabled ? "text-orange-700 border-orange-300 bg-orange-50" : "text-slate-500 border-slate-300 bg-slate-50"}`}>
          Sveglia {sveglia.enabled ? `ATTIVA ${sveglia.time}` : "disattivata"}
        </span>
      </div>

      {listaOggetti.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {listaOggetti.map((o: any) => (
            <span key={o.label_it} className="text-[11px] px-2 py-0.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-800" title={`Confidenza ${Math.round((o.conf || 0) * 100)}% — visto ${o.count} volte`}>
              {o.label_it} · {o.source} · {new Date(o.lastSeen).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
          ))}
        </div>
      )}

      <div className="max-h-[260px] overflow-y-auto divide-y divide-slate-100">
        {entries.length === 0 && (
          <p className="text-[11px] text-slate-400 py-3 text-center">
            Diario vuoto: si riempie con gli avvistamenti delle postazioni video e i comandi "ricordati che...".
          </p>
        )}
        {entries.map(e => (
          <div key={e.id} className="flex items-center gap-2 py-1 text-[11px]">
            <span className="font-mono text-slate-400 shrink-0">
              {new Date(e.ts).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className={`font-bold shrink-0 ${e.kind === "memoria" ? "text-emerald-700" : e.kind === "visione" ? "text-indigo-700" : e.kind === "sveglia" ? "text-orange-700" : "text-slate-600"}`}>
              {KIND_LABEL[e.kind] || e.kind}
            </span>
            <span className="text-slate-700 truncate">{e.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Pannello "Cura quotidiana": funzioni clonate da KindredMind, tutte offline.
// Pattern UX rubato alla loro app: ogni campo è una card con titolo + UNA riga
// che dice la conseguenza concreta, non un settaggio nudo. Salvataggio unico.
function PannelloCura() {
  const [care, setCare] = useState<any>(null);
  const [salvato, setSalvato] = useState(false);
  const [nuovoProm, setNuovoProm] = useState({ time: "", text: "" });
  const [nuovoCheckin, setNuovoCheckin] = useState("");

  useEffect(() => {
    fetch("/api/care").then(r => r.json()).then(setCare).catch(() => {});
  }, []);

  if (!care) return null;

  const salva = (patch: any) => {
    const next = { ...care, ...patch };
    setCare(next);
    fetch("/api/care", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next)
    })
      .then(r => r.json())
      .then(d => { setCare(d); setSalvato(true); setTimeout(() => setSalvato(false), 1500); })
      .catch(() => {});
  };

  const campo = (k: string, titolo: string, spiega: string, placeholder: string, righe = 2) => (
    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
      <p className="text-xs font-extrabold text-slate-900">{titolo}</p>
      <p className="text-[11px] text-slate-500">{spiega}</p>
      <textarea
        rows={righe}
        value={care[k] || ""}
        placeholder={placeholder}
        onChange={e => setCare({ ...care, [k]: e.target.value })}
        onBlur={() => salva({})}
        className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white text-slate-800 resize-y"
      />
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-sm text-slate-900">Cura Quotidiana</h3>
          <p className="text-xs text-slate-500">
            Quello che scrivi qui entra in OGNI conversazione del companion. Dieci minuti a settimana bastano.
          </p>
        </div>
        {salvato && <span className="text-[11px] font-bold text-emerald-700">Salvato ✓</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {campo("quickUpdates", "Novità di famiglia", "Notizie vere che il companion racconta con naturalezza (\"il nipote ha segnato il primo gol\").", "Una novità per riga...")}
        {campo("nextVisit", "Prossima visita reale", "Se chiede \"quando vieni?\" risponde con QUESTA. Vuota = rassicura senza promettere. Mai bugie sugli arrivi.", "es. domenica alle 15 viene Francesca", 1)}
        {campo("soothes", "Cosa lo calma", "Appigli usati quando è agitato: argomenti, ricordi, abitudini che lo rasserenano.", "Una per riga...")}
        {campo("avoid", "Cosa evitare", "Argomenti o frasi da non toccare mai (lutti da non confermare, orari da non promettere...).", "Una per riga...")}
        {campo("dailyRhythm", "Ritmo quotidiano", "La giornata reale (colazione, riposo, orari): il companion ancora il discorso a ciò che accade davvero.", "es. mattina: caffè e finestra; pomeriggio: si agita verso le 16...")}
      </div>

      {/* Promemoria detti a voce dal kiosk */}
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
        <p className="text-xs font-extrabold text-slate-900">Promemoria a voce</p>
        <p className="text-[11px] text-slate-500">
          All'ora scelta il kiosk lo dice con la sua voce: medicine, pasti, appuntamenti. Scrivilo come va detto.
        </p>
        {(care.reminders || []).map((r: any) => (
          <div key={r.id} className="flex items-center gap-2 text-xs">
            <span className="font-mono font-bold text-slate-800 shrink-0">{r.time}</span>
            <span className="text-slate-700 truncate flex-1">{r.text}</span>
            <button
              type="button"
              onClick={() => salva({ reminders: care.reminders.filter((x: any) => x.id !== r.id) })}
              className="text-red-600 font-bold px-1.5 hover:bg-red-50 rounded"
            >×</button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <input
            type="time" value={nuovoProm.time}
            onChange={e => setNuovoProm({ ...nuovoProm, time: e.target.value })}
            className="text-xs p-1.5 rounded-lg border border-slate-300 bg-white"
          />
          <input
            type="text" value={nuovoProm.text} placeholder="es. È ora della medicina della pressione, è sul tavolo della cucina"
            onChange={e => setNuovoProm({ ...nuovoProm, text: e.target.value })}
            className="flex-1 text-xs p-1.5 rounded-lg border border-slate-300 bg-white"
          />
          <button
            type="button"
            onClick={() => {
              if (!/^\d{2}:\d{2}$/.test(nuovoProm.time) || !nuovoProm.text.trim()) return;
              salva({ reminders: [...(care.reminders || []), { time: nuovoProm.time, text: nuovoProm.text.trim() }] });
              setNuovoProm({ time: "", text: "" });
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold"
          >Aggiungi</button>
        </div>
      </div>

      {/* Check-in proattivi */}
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-extrabold text-slate-900">Check-in proattivi</p>
            <p className="text-[11px] text-slate-500">
              Agli orari scelti è il companion a salutare per primo, prima che la solitudine arrivi. Spento finché non lo attivi tu.
            </p>
          </div>
          <button
            type="button"
            onClick={() => salva({ checkin: { ...care.checkin, enabled: !care.checkin?.enabled } })}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${care.checkin?.enabled ? "bg-emerald-600 text-white" : "bg-white border border-slate-300 text-slate-700"}`}
          >{care.checkin?.enabled ? "Attivo" : "Spento"}</button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(care.checkin?.times || []).map((t: string) => (
            <span key={t} className="flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-slate-300 text-xs font-mono font-bold text-slate-800">
              {t}
              <button
                type="button"
                onClick={() => salva({ checkin: { ...care.checkin, times: care.checkin.times.filter((x: string) => x !== t) } })}
                className="text-red-600 font-bold"
              >×</button>
            </span>
          ))}
          <input
            type="time" value={nuovoCheckin}
            onChange={e => setNuovoCheckin(e.target.value)}
            className="text-xs p-1.5 rounded-lg border border-slate-300 bg-white"
          />
          <button
            type="button"
            onClick={() => {
              if (!/^\d{2}:\d{2}$/.test(nuovoCheckin)) return;
              if ((care.checkin?.times || []).includes(nuovoCheckin)) return;
              salva({ checkin: { ...care.checkin, times: [...(care.checkin?.times || []), nuovoCheckin].sort() } });
              setNuovoCheckin("");
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold"
          >Aggiungi orario</button>
        </div>
      </div>
    </div>
  );
}

// Registrazione voce del caregiver per il futuro training TTS (clonazione).
// Livelli stile KindredMind: 5 min Iniziale, 30 Raffinata, 60 Vera, 90 Firma.
// I campioni restano in data/voice-training/ sulla macchina: mai su GitHub.
function RegistrazioneVoce() {
  const [samples, setSamples] = useState<any[]>([]);
  const [totalSec, setTotalSec] = useState(0);
  const [tier, setTier] = useState("In costruzione");
  const [rec, setRec] = useState(false);
  const [sec, setSec] = useState(0);
  const [errore, setErrore] = useState("");
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const startRef = useRef(0);

  const carica = () => {
    fetch("/api/voice-samples").then(r => r.json()).then(d => {
      if (Array.isArray(d?.samples)) setSamples(d.samples);
      if (typeof d?.totalSec === "number") setTotalSec(d.totalSec);
      if (d?.tier) setTier(d.tier);
    }).catch(() => {});
  };
  useEffect(() => { carica(); }, []);

  const avvia = async () => {
    setErrore("");
    try {
      // niente cancellazione eco/rumore: per il training serve la voce vera
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const durata = Math.round((Date.now() - startRef.current) / 1000);
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        if (durata < 3 || !blob.size) return;
        const fr = new FileReader();
        fr.onload = () => {
          fetch("/api/voice-sample", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audio_b64: fr.result, mimeType: blob.type, seconds: durata })
          }).then(() => carica()).catch(() => setErrore("Salvataggio fallito: riprova."));
        };
        fr.readAsDataURL(blob);
      };
      recRef.current = mr;
      startRef.current = Date.now();
      mr.start();
      setRec(true);
      setSec(0);
      timerRef.current = setInterval(() => setSec(Math.round((Date.now() - startRef.current) / 1000)), 1000);
    } catch {
      setErrore("Microfono non disponibile: controlla i permessi del browser.");
    }
  };

  const ferma = () => {
    clearInterval(timerRef.current);
    setRec(false);
    try { recRef.current?.stop(); } catch {}
  };

  useEffect(() => () => { clearInterval(timerRef.current); try { recRef.current?.stop(); } catch {} }, []);

  const min = Math.floor(totalSec / 60);
  const prossimo = totalSec < 300 ? { nome: "Voce Iniziale", a: 300 }
    : totalSec < 1800 ? { nome: "Voce Raffinata", a: 1800 }
    : totalSec < 3600 ? { nome: "Voce Vera", a: 3600 }
    : totalSec < 5400 ? { nome: "Voce Firma", a: 5400 } : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-sm text-slate-900">La Tua Voce</h3>
          <p className="text-xs text-slate-500">
            Registra qui la tua voce, parlando come parli: servirà per far parlare il companion con la TUA voce. Resta su questa macchina, mai in rete.
          </p>
        </div>
        <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold shrink-0">
          {min} min · {tier}
        </span>
      </div>

      {prossimo && (
        <div className="space-y-1">
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${Math.min(100, (totalSec / prossimo.a) * 100)}%` }} />
          </div>
          <p className="text-[11px] text-slate-500">
            {Math.max(0, Math.ceil((prossimo.a - totalSec) / 60))} minuti alla {prossimo.nome}. Meglio poco e in una stanza silenziosa che tanto col rumore.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        {!rec ? (
          <button
            type="button" onClick={avvia}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
          >● Registra</button>
        ) : (
          <button
            type="button" onClick={ferma}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold animate-pulse"
          >■ Ferma ({Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")})</button>
        )}
        {errore && <span className="text-[11px] text-red-600 font-bold">{errore}</span>}
      </div>

      {samples.length > 0 && (
        <div className="max-h-[140px] overflow-y-auto divide-y divide-slate-100">
          {samples.map(s => (
            <div key={s.id} className="flex items-center gap-2 py-1 text-[11px]">
              <span className="font-mono text-slate-400 shrink-0">
                {new Date(s.ts).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="text-slate-700 flex-1">{Math.floor(s.seconds / 60)}:{String(s.seconds % 60).padStart(2, "0")}</span>
              <button
                type="button"
                onClick={() => fetch("/api/voice-sample/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: s.id }) }).then(() => carica())}
                className="text-red-600 font-bold px-1.5 hover:bg-red-50 rounded"
              >×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
