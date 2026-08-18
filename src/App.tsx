import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { AlzheimerCompanionView } from "./components/AlzheimerCompanionView";
import { CaregiverMasterHub } from "./components/CaregiverMasterHub";
import { HomeUserView } from "./components/HomeUserView";
import { DialectActiveLearningStudio } from "./components/DialectActiveLearningStudio";
import { AdminConfigPanel } from "./components/AdminConfigPanel";
import { HostExtractionGuide } from "./components/HostExtractionGuide";
import { AudioVideoTerminal } from "./components/AudioVideoTerminal";
import { SurveillanceGrid } from "./components/SurveillanceGrid";
import KioskVoiceCompanion from "./components/KioskVoiceCompanion";
import { EdgeNodesMesh } from "./components/EdgeNodesMesh";
import { HapticPeripheralsPanel } from "./components/HapticPeripheralsPanel";
import { KnowledgeGraphViewer } from "./components/KnowledgeGraphViewer";
import { MicroservicesMonitor } from "./components/MicroservicesMonitor";
import { VoiceTuningStudio } from "./components/VoiceTuningStudio";
import {
  EdgeNode,
  ChatMessage,
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
  RAGDocument,
  MicroserviceContainer,
  HapticAction,
  SpeakerVoiceProfile,
  OperationalViewMode,
  AdminConfig,
  ClientSlaveSession,
  BiographicalMemoryEntry,
  CaregiverAlert,
  ProxmoxServerInfo
} from "./types";
import { triggerHapticFeedback } from "./utils/haptics";

const DEFAULT_PROFILE: SpeakerVoiceProfile = {
  // Profilo di default NEUTRO: il nome vero lo imposta il caregiver dall'admin.
  // (I dati personali del soggetto vivono in data/ e nel localStorage della postazione,
  //  mai nel codice: chi clona la repo parte pulito.)
  id: "profile_default",
  speakerName: "Ospite",
  language: "it-IT",
  pitch: 1.0,
  rate: 1.05,
  speakingRate: 1.05,
  f0FundamentalHz: 155,
  vowelFormantBoost: 1.15,
  formantResonance: "NATURAL",
  responsePersona: "EMPATHIC_EXPLANATORY",
  silenceThresholdMs: 900,
  accentRegion: "standard_italian",
  noiseSuppression: true,
  calibrationStatus: {
    isCalibrated: true,
    averagePitchHz: 155,
    sampleSnrDb: 31.4,
    calibratedDate: new Date().toLocaleDateString("it-IT"),
    sampleCount: 3
  },
  customVocabulary: [
    { id: "v_1", phrase: "EdgeMesh", phoneticAlt: "edg mesc", phoneticHint: "edg mesci", replaceWith: "EdgeMesh", boost: 0.95 },
    { id: "v_2", phrase: "RAG", phoneticAlt: "rag", phoneticHint: "rag", replaceWith: "RAG", boost: 0.9 },
    { id: "v_3", phrase: "INT4", phoneticAlt: "int quattro", phoneticHint: "int quattro", replaceWith: "INT4", boost: 0.95 },
    { id: "v_4", phrase: "Aptico", phoneticAlt: "aptico", phoneticHint: "aptico", replaceWith: "aptico", boost: 0.9 },
    { id: "v_5", phrase: "Duplex", phoneticAlt: "diuplex", phoneticHint: "diuplex", replaceWith: "duplex", boost: 0.9 }
  ]
};

const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  masterNodeName: "VoiceFollower-Master-Central",
  masterHostIp: "192.168.1.120",
  gpuServerIp: "192.168.1.88",
  gpuServerPort: 8000,
  ttsEngine: "KOKORO_82M_NEURAL",
  ttsHuggingFaceModel: "hexgrad/Kokoro-82M-v0.19-it (HuggingFace)",
  geminiApiKey: "",
  deepseekApiKey: "",
  glmApiKey: "",
  localLlmEndpoint: "http://192.168.1.89:9101/v1",
  localLlmModel: "vf-brain",
  primaryProvider: "local_ollama",
  fallbackProvider: "local_ollama",
  autoLearnDialects: true,
  masterRequireAuth: false,
  databaseStorageType: "SQL_RELATIONAL",
  syncIntervalSec: 5
};

// Modalità postazione: un dispositivo sempre acceso (PC, tablet, telefono)
// apre l'URL con ?vista=... e diventa una postazione dedicata senza menu.
// Es: http://192.168.1.89:3000/?vista=sorveglianza&kiosk=1  (PC postazione .4)
//     http://192.168.1.89:3000/?vista=companion&kiosk=1     (schermo del paziente)
function readStationParams(): { view: OperationalViewMode | null; kiosk: boolean } {
  try {
    const p = new URLSearchParams(window.location.search);
    const vista = (p.get("vista") || "").toLowerCase();
    const view: OperationalViewMode | null =
      vista === "sorveglianza" ? "SURVEILLANCE"
      : vista === "companion" || vista === "paziente" ? "COMPANION_ALZHEIMER"
      : vista === "caregiver" ? "CAREGIVER_MASTER"
      : null;
    return { view, kiosk: p.get("kiosk") === "1" };
  } catch {
    return { view: null, kiosk: false };
  }
}
const STATION = readStationParams();

export default function App() {
  const [viewMode, setViewMode] = useState<OperationalViewMode>(STATION.view || "COMPANION_ALZHEIMER");
  const kioskMode = STATION.kiosk;
  const [adminTab, setAdminTab] = useState<"dialects" | "config" | "terminal" | "voiceStudio" | "mesh" | "haptics" | "graph" | "microservices" | "extraction">("dialects");
  const [useHighThinking, setUseHighThinking] = useState<boolean>(false);
  const [offlineMode, setOfflineMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [systemLatency, setSystemLatency] = useState<number>(14);
  const [latestHaptic, setLatestHaptic] = useState<HapticAction | null>(null);

  // Admin Config state
  const [adminConfig, setAdminConfig] = useState<AdminConfig>(DEFAULT_ADMIN_CONFIG);

  // LAN Client Sessions state (Realme GT 7 Pro, Tablet, Smartwatch)
  const [clientSessions, setClientSessions] = useState<ClientSlaveSession[]>([]);
  
  // Biographical Memories & Caregiver Alerts
  const [biographicalMemories, setBiographicalMemories] = useState<BiographicalMemoryEntry[]>([]);
  const [caregiverAlerts, setCaregiverAlerts] = useState<CaregiverAlert[]>([]);
  const [proxmoxInfo, setProxmoxInfo] = useState<ProxmoxServerInfo>({
    ddnsDomain: "",
    lanIp: "192.168.1.88",
    serverModel: "Dell PowerEdge R740 (Proxmox VE 8.2)",
    gpuModel: "NVIDIA Tesla P40 (24 GB GDDR5 VRAM)",
    vramTotalGb: 24.0,
    vramUsedGb: 6.84,
    gpuTempC: 44,
    ollamaStatus: true,
    whisperSttStatus: true,
    kokoroTtsStatus: true,
    activeModel: "Qwen2.5-7B-Instruct / Kokoro-82M-v0.19 (P40 GPU Accel)",
    isReachable: true
  });

  useEffect(() => {
    // 1. Load Admin Config
    fetch("/api/admin/config")
      .then(res => res.json())
      .then(data => {
        if (data && data.config) setAdminConfig(data.config);
      })
      .catch(() => {});

    // 2. Load LAN Client Sessions
    fetch("/api/clients/sessions")
      .then(res => res.json())
      .then(data => {
        if (data && data.sessions) setClientSessions(data.sessions);
      })
      .catch(() => {});

    // 3. Load Biographical Memories
    fetch("/api/memory/biography")
      .then(res => res.json())
      .then(data => {
        if (data && data.memories) setBiographicalMemories(data.memories);
      })
      .catch(() => {});

    // 4. Load Caregiver Alerts
    fetch("/api/caregiver/alerts")
      .then(res => res.json())
      .then(data => {
        if (data && data.alerts) setCaregiverAlerts(data.alerts);
      })
      .catch(() => {});

    // 5. Load Proxmox Dell R740 status
    fetch("/api/proxmox/status")
      .then(res => res.json())
      .then(data => {
        if (data) setProxmoxInfo(data);
      })
      .catch(() => {});
  }, []);

  const handleUpdateClientPermission = async (clientId: string, permissionKey: string, value: any) => {
    try {
      const res = await fetch("/api/clients/toggle-permission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, permissionKey, value })
      });
      const data = await res.json();
      if (data && data.client) {
        setClientSessions(prev => prev.map(c => c.id === clientId ? data.client : c));
        triggerHapticFeedback("CONFIRMATION_PULSE", 0.6, 90);
      }
    } catch (e) {
      console.error("Error updating client permission:", e);
    }
  };

  const handleUpdateClientVolume = async (clientId: string, volumeLevel: number) => {
    try {
      const res = await fetch("/api/clients/volume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, volumeLevel })
      });
      const data = await res.json();
      if (data && data.client) {
        setClientSessions(prev => prev.map(c => c.id === clientId ? data.client : c));
      }
    } catch (e) {
      console.error("Error updating client volume:", e);
    }
  };

  const handleAddBiographicalMemory = async (entry: Partial<BiographicalMemoryEntry>) => {
    try {
      const res = await fetch("/api/memory/biography/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry)
      });
      const data = await res.json();
      if (data && data.memory) {
        setBiographicalMemories(prev => [data.memory, ...prev]);
        triggerHapticFeedback("CONFIRMATION_PULSE", 0.7, 100);
      }
    } catch (e) {
      console.error("Error adding biographical memory:", e);
    }
  };

  const handleUpdateBiographicalMemory = async (id: string, patch: Partial<BiographicalMemoryEntry>) => {
    try {
      const res = await fetch("/api/memory/biography/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch })
      });
      const data = await res.json();
      if (data && data.memories) setBiographicalMemories(data.memories);
    } catch (e) {
      console.error("Error updating biographical memory:", e);
    }
  };

  const handleDeleteBiographicalMemory = async (id: string) => {
    try {
      const res = await fetch("/api/memory/biography/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data && data.memories) setBiographicalMemories(data.memories);
    } catch (e) {
      console.error("Error deleting biographical memory:", e);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      const res = await fetch("/api/caregiver/alerts/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId })
      });
      const data = await res.json();
      if (data && data.alerts) {
        setCaregiverAlerts(data.alerts);
        triggerHapticFeedback("CONFIRMATION_PULSE", 0.5, 80);
      }
    } catch (e) {
      console.error("Error resolving alert:", e);
    }
  };

  // Persistent speaker profile with Italian voice tuning
  const [speakerProfile, setSpeakerProfile] = useState<SpeakerVoiceProfile>(() => {
    try {
      const saved = localStorage.getItem("edgemesh_speaker_profile");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_PROFILE;
  });

  const handleUpdateProfile = (updated: SpeakerVoiceProfile) => {
    setSpeakerProfile(updated);
    try {
      localStorage.setItem("edgemesh_speaker_profile", JSON.stringify(updated));
    } catch {}
  };

  // Initial Edge Mesh Units
  const [nodes, setNodes] = useState<EdgeNode[]>([
    {
      id: "cpu_central",
      name: "Unità Master Centrale Neurale",
      role: "CENTRAL_CPU",
      status: "ONLINE",
      ip: "10.240.0.1",
      frequency: "5.8 GHz TDMA",
      signalDbm: -32,
      latencyMs: 3,
      batteryPct: 100,
      encryption: "AES-256-GCM",
      packetsProcessed: 24820,
      coordinates: { x: 50, y: 48 }
    },
    {
      id: "node_av_term_1",
      name: "Pod Slave Terminale A/V Alpha",
      role: "AV_TERMINAL",
      status: "ONLINE",
      ip: "10.240.0.11",
      frequency: "5.8 GHz TDMA",
      signalDbm: -48,
      latencyMs: 14,
      batteryPct: 92,
      encryption: "ChaCha20",
      packetsProcessed: 8410,
      coordinates: { x: 22, y: 28 }
    },
    {
      id: "node_av_term_2",
      name: "Realme GT 7 Pro (Slave A/V LAN)",
      role: "AV_TERMINAL",
      status: "ONLINE",
      ip: "192.168.1.45",
      frequency: "5.8 GHz Wi-Fi 6 (LAN)",
      signalDbm: -42,
      latencyMs: 12,
      batteryPct: 91,
      encryption: "ChaCha20",
      packetsProcessed: 5940,
      coordinates: { x: 78, y: 28 }
    },
    {
      id: "node_gpu_server",
      name: "Server GPU Host (Tesla P40 24GB)",
      role: "CENTRAL_CPU",
      status: "ONLINE",
      ip: "192.168.1.88",
      frequency: "Ethernet LAN 10GbE",
      signalDbm: -10,
      latencyMs: 3,
      batteryPct: 100,
      encryption: "AES-256-GCM",
      packetsProcessed: 28450,
      coordinates: { x: 50, y: 15 }
    },
    {
      id: "node_haptic_band",
      name: "Smartwatch / Polsino Aptico 01",
      role: "HAPTIC_BAND",
      status: "ONLINE",
      ip: "10.240.0.21",
      frequency: "2.4 GHz BLE-Mesh",
      signalDbm: -44,
      latencyMs: 6,
      batteryPct: 95,
      encryption: "ChaCha20",
      packetsProcessed: 1240,
      coordinates: { x: 24, y: 72 }
    }
  ]);

  // Initial Knowledge Graph
  const [graphData, setGraphData] = useState<{ nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] }>({
    nodes: [
      { id: "cpu_central", label: "Central Neural CPU", category: "entity", attributes: { status: "ONLINE", npu_load: "28%" } },
      { id: "node_av_term_1", label: "Terminale A/V Alpha", category: "peripheral", attributes: { type: "Hub Voce/Video", latency_ms: 14 } },
      { id: "node_haptic_band", label: "Smartwatch Aptico", category: "peripheral", attributes: { protocol: "BLE-Mesh / 2.4GHz", freq: "180Hz" } },
      // NB: niente persone/ricordi pre-caricati — il grafo biografico parte VUOTO
      // e si riempie SOLO con ciò che inserisce il caregiver (vedi task #10).
      { id: "user_profile", label: "Biometria & Stato Paziente", category: "memory", attributes: { stato_animo: "SERENO", ancoraggio: "ATTIVO" } },
      { id: "dialect_bada", label: "Dialetto: Bada lì (Attenzione)", category: "memory", attributes: { source: "Smartphone Wi-Fi", region: "Toscana", cataloged: "DB+Graph" } },
      { id: "dialect_nana", label: "Parola: Nàna (Pausa/Standby)", category: "memory", attributes: { source: "Paziente", type: "Inventata/Affettiva", cataloged: "DB+Graph" } }
    ],
    edges: [
      { source: "cpu_central", target: "node_av_term_1", relation: "DUPLEX_AUDIO_VIDEO_STREAM", weight: 0.95 },
      { source: "cpu_central", target: "node_haptic_band", relation: "ENCRYPTED_HAPTIC_TELEMETRY", weight: 0.9 },
      { source: "cpu_central", target: "user_profile", relation: "REALTIME_CONTEXT_EXTRACTION", weight: 0.99 },
      { source: "cpu_central", target: "dialect_bada", relation: "ACTIVE_LEARNING_TOKEN", weight: 0.94 },
      { source: "cpu_central", target: "dialect_nana", relation: "INVENTED_WORD_MAPPING", weight: 0.96 }
    ]
  });

  // Vector RAG Docs
  const [ragDocs, setRagDocs] = useState<RAGDocument[]>([
    {
      id: "doc_mesh_proto",
      title: "Protocollo Wireless Duplex Wi-Fi Master/Slave",
      category: "Architettura",
      content: "EdgeMesh utilizza canali wireless a divisione di tempo (TDMA) a 2.4GHz/5.8GHz con crittografia ChaCha20-Poly1305. I payload includono frame audio PCM sub-20ms, stream video compressi H.265 e pacchetti di modulazione aptica a 8 byte."
    },
    {
      id: "doc_alzheimer",
      title: "Terapia della Validazione e Ancore Biografiche per Alzheimer",
      category: "Companion & Cura",
      content: "Principi neuro-comunicativi: mai contraddire il paziente in stato confusionale; validare sempre lo stato emotivo; usare ancore biografiche positive (coniuge, figli, canzoni d'epoca, luoghi del cuore) e risposte brevi e dolci con sintesi neurale Kokoro-82M."
    },
    {
      id: "doc_dialects",
      title: "Motore di Addestramento Attivo Dialetti & Neologismi",
      category: "Linguistica & Grafo",
      content: "I termini dialettali, le parole inventate e i versi catturati dai terminali slave durante i dialoghi vengono doppiamente catalogati: 1) in tabella SQLite/PostgreSQL relazionale per query puntuali, e 2) come nodi e archi nel Knowledge Graph semantico con associazioni a ricordi ed etimologia."
    }
  ]);

  // Microservice Containers
  const [containers, setContainers] = useState<MicroserviceContainer[]>([
    { id: "svc-gateway", name: "edge-duplex-gateway", image: "edgemesh/gateway:v3.2", status: "running", port: 50051, cpu: "4.2%", mem: "142 MB", latency: "3.2ms", encrypted: true },
    { id: "svc-orchestrator", name: "llm-orchestrator-core", image: "edgemesh/orchestrator:v4.2-multillm", status: "running", port: 8080, cpu: "18.5%", mem: "512 MB", latency: "42ms", encrypted: true },
    { id: "svc-rag", name: "rag-vector-engine", image: "edgemesh/chroma-rag:v2.0", status: "running", port: 6333, cpu: "6.1%", mem: "290 MB", latency: "8.5ms", encrypted: true },
    { id: "svc-graph", name: "graph-memory-engine", image: "edgemesh/memgraph-nx:v1.8", status: "running", port: 7474, cpu: "5.4%", mem: "310 MB", latency: "6.1ms", encrypted: true },
    { id: "svc-haptic", name: "haptic-dsp-broker", image: "edgemesh/haptic-dsp:v2.5", status: "running", port: 9092, cpu: "2.1%", mem: "85 MB", latency: "1.8ms", encrypted: true },
    { id: "svc-offline-npu", name: "offline-quantized-npu", image: "edgemesh/int4-awq-engine:v3.0", status: "standby_ready", port: 8088, cpu: "1.0%", mem: "1.4 GB", latency: "12.0ms", encrypted: true }
  ]);

  // Conversation history with Italian greeting
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg_init",
      sender: "central_cpu",
      text: "Ciao! Sono VoiceFollower, il tuo assistente amico. Sei a casa tua, tutto va bene e puoi parlarmi quando vuoi.",
      timestamp: new Date().toLocaleTimeString("it-IT"),
      modelUsed: "gemini-3.7-flash",
      thinkingMode: "STANDARD",
      latencyMs: 14,
      hapticAction: {
        targetNode: "node_haptic_band",
        pattern: "CONFIRMATION_PULSE",
        intensity: 0.7,
        durationMs: 150,
        hapticDescription: "Impulso di rassicurazione e benvenuto."
      }
    }
  ]);

  // Periodic latency simulation
  useEffect(() => {
    const intv = setInterval(() => {
      setSystemLatency(offlineMode ? Math.floor(Math.random() * 4 + 10) : Math.floor(Math.random() * 8 + 12));
    }, 3000);
    return () => clearInterval(intv);
  }, [offlineMode]);

  // Handle user message dispatch
  const handleSendMessage = async (text: string, imageBase64?: string) => {
    const userMsg: ChatMessage = {
      id: "msg_" + Date.now(),
      sender: "user",
      text: text || "[Frame Snapshot Inviato]",
      timestamp: new Date().toLocaleTimeString("it-IT"),
      visualSnapshot: imageBase64
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    triggerHapticFeedback("CONFIRMATION_PULSE", 0.5, 80);

    try {
      const activeNodeIds = nodes.map(n => n.id);
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          useHighThinking,
          offlineMode,
          imageBase64,
          activeNodes: activeNodeIds,
          speakerProfile,
          language: speakerProfile.language || "it-IT"
        })
      });

      const data = await res.json();

      const cpuMsg: ChatMessage = {
        id: "msg_cpu_" + Date.now(),
        sender: offlineMode ? "offline_npu" : "central_cpu",
        text: data.spokenResponse || "Ti ascolto sempre con affetto, dimmi pure.",
        timestamp: new Date().toLocaleTimeString("it-IT"),
        modelUsed: data.modelUsed,
        thinkingMode: data.thinkingMode,
        latencyMs: data.latencyMs || (offlineMode ? 14 : 95),
        taskPlan: data.taskPlan,
        hapticAction: data.hapticAction,
        knowledgeGraphUpdates: data.knowledgeGraphUpdates,
        quantizedOfflineCompatible: data.quantizedOfflineCompatible
      };

      setMessages(prev => [...prev, cpuMsg]);

      // Trigger Haptic feedback if returned
      if (data.hapticAction) {
        setLatestHaptic(data.hapticAction);
        triggerHapticFeedback(
          data.hapticAction.pattern,
          data.hapticAction.intensity || 0.7,
          data.hapticAction.durationMs || 150
        );
      }

      // Append new dynamic nodes to Knowledge Graph if returned
      if (Array.isArray(data.knowledgeGraphUpdates) && data.knowledgeGraphUpdates.length > 0) {
        setGraphData(prev => {
          const newNodes = [...prev.nodes];
          const newEdges = [...prev.edges];

          for (const item of data.knowledgeGraphUpdates) {
            const id = "dyn_" + Math.random().toString(36).substring(2, 7);
            if (!newNodes.some(n => n.label.toLowerCase() === item.nodeLabel.toLowerCase())) {
              newNodes.push({
                id,
                label: item.nodeLabel,
                category: (item.category as any) || "memory",
                attributes: { origin: "Interazione dal Vivo", time: new Date().toLocaleTimeString("it-IT") }
              });
              newEdges.push({
                source: "cpu_central",
                target: id,
                relation: item.relationTo || "COLLEGAMENTO_DINAMICO",
                weight: 0.9
              });
            }
          }
          return { nodes: newNodes, edges: newEdges };
        });
      }
    } catch (err: any) {
      console.error("Richiesta di orchestrazione fallita:", err);
      // Fallback
      const errorMsg: ChatMessage = {
        id: "msg_err_" + Date.now(),
        sender: "offline_npu",
        text: "Sono qui con te. Ricorda che sei a casa tranquillo e sereno.",
        timestamp: new Date().toLocaleTimeString("it-IT"),
        modelUsed: "local-int4-awq-quantized",
        thinkingMode: "OFFLINE_LOCAL_NPU",
        latencyMs: 18,
        hapticAction: {
          targetNode: "node_haptic_band",
          pattern: "CONFIRMATION_PULSE",
          intensity: 0.6,
          durationMs: 120,
          hapticDescription: "Impulso di conferma da canale offline locale."
        }
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Node actions
  const handlePingNode = (nodeId: string) => {
    setNodes(prev =>
      prev.map(n =>
        n.id === nodeId
          ? { ...n, packetsProcessed: n.packetsProcessed + 1, latencyMs: Math.max(3, n.latencyMs - 1) }
          : n
      )
    );
    triggerHapticFeedback("CONFIRMATION_PULSE", 0.6, 90);
  };

  const handleAddNode = (name: string, role: any) => {
    const id = "node_pod_" + Math.random().toString(36).substring(2, 6);
    const newNode: EdgeNode = {
      id,
      name,
      role: role || "SENSOR_POD",
      status: "ONLINE",
      ip: `10.240.0.${Math.floor(Math.random() * 50 + 30)}`,
      frequency: "2.4 GHz TDMA",
      signalDbm: -50,
      latencyMs: 12,
      batteryPct: 98,
      encryption: "ChaCha20",
      packetsProcessed: 12,
      coordinates: {
        x: Math.floor(Math.random() * 60 + 20),
        y: Math.floor(Math.random() * 60 + 20)
      }
    };
    setNodes(prev => [...prev, newNode]);
    triggerHapticFeedback("CONFIRMATION_PULSE", 0.7, 100);
  };

  const handleAddGraphNode = (label: string, category: any, relationTo: string) => {
    const id = "node_" + Math.random().toString(36).substring(2, 7);
    setGraphData(prev => ({
      nodes: [
        ...prev.nodes,
        { id, label, category, attributes: { userCreated: true, timestamp: new Date().toISOString() } }
      ],
      edges: [
        ...prev.edges,
        { source: "cpu_central", target: id, relation: relationTo || "MANUAL_CONTEXT", weight: 0.95 }
      ]
    }));
  };

  const handleToggleContainer = (id: string, action: "restart" | "toggle") => {
    setContainers(prev =>
      prev.map(c => {
        if (c.id === id) {
          if (action === "restart") {
            return { ...c, status: "restarting" as const };
          } else {
            return { ...c, status: c.status === "running" ? "stopped" as const : "running" as const };
          }
        }
        return c;
      })
    );

    if (action === "restart") {
      setTimeout(() => {
        setContainers(prev =>
          prev.map(c => (c.id === id ? { ...c, status: "running" as const } : c))
        );
      }, 1400);
    }
  };

  // Find active companion device settings
  const activeCompanionDevice = clientSessions.find(s => s.id === "client_gt7pro") || clientSessions[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-500/20 selection:text-indigo-900">
      {/* Top Telemetry & Mode Navigation Header (nascosto in modalità postazione/kiosk) */}
      {!kioskMode && <Header
        viewMode={viewMode}
        setViewMode={setViewMode}
        adminTab={adminTab}
        setAdminTab={setAdminTab}
        useHighThinking={useHighThinking}
        setUseHighThinking={setUseHighThinking}
        offlineMode={offlineMode}
        setOfflineMode={setOfflineMode}
        activeNodesCount={nodes.length}
        systemLatency={systemLatency}
        speakerProfile={speakerProfile}
        onUpdateProfile={handleUpdateProfile}
      />}

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-2 sm:p-4 md:p-6">
        {/* Mode 1: Alzheimer Companion View (Patient Friendly, High Empathy, Big Clock, Calming Anchors) */}
        {viewMode === "COMPANION_ALZHEIMER" && (
          <AlzheimerCompanionView
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            biographicalMemories={biographicalMemories}
            patientName={speakerProfile.speakerName.split(" ")[0] || "Ospite"}
            volumeLevel={activeCompanionDevice?.volumeLevel || 85}
            isMicAllowed={activeCompanionDevice?.audioStreamRxEnabled ?? true}
            isCameraAllowed={activeCompanionDevice?.videoStreamRxEnabled ?? true}
            onOpenCaregiverMaster={() => setViewMode("CAREGIVER_MASTER")}
            voiceProfile={speakerProfile}
          />
        )}

        {/* Mode 2: Caregiver Master Hub (LAN Device Permissions, Memories, Alerts, Server P40) */}
        {viewMode === "CAREGIVER_MASTER" && (
          <CaregiverMasterHub
            clients={clientSessions}
            biographicalMemories={biographicalMemories}
            caregiverAlerts={caregiverAlerts}
            proxmoxInfo={proxmoxInfo}
            adminConfig={adminConfig}
            graphData={graphData}
            onUpdateClientPermission={handleUpdateClientPermission}
            onUpdateClientVolume={handleUpdateClientVolume}
            onAddBiographicalMemory={handleAddBiographicalMemory}
            onUpdateBiographicalMemory={handleUpdateBiographicalMemory}
            onDeleteBiographicalMemory={handleDeleteBiographicalMemory}
            onResolveAlert={handleResolveAlert}
            onSwitchToCompanionView={() => setViewMode("COMPANION_ALZHEIMER")}
            onUpdateAdminConfig={setAdminConfig}
          />
        )}

        {/* Mode 2b: Sorveglianza ambientale multi-fonte (attivazione automatica a eventi) */}
        {viewMode === "SURVEILLANCE" && <SurveillanceGrid />}
        {/* In kiosk la postazione di sorveglianza ha anche il ciclo vocale:
            ascolta la stanza, chiede al cervello, risponde dalla cassa. */}
        {viewMode === "SURVEILLANCE" && kioskMode && <KioskVoiceCompanion />}

        {/* Mode 3: Legacy Home User View (BTicino Scenarios) */}
        {viewMode === "HOME_USER" && (
          <HomeUserView
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            latestHaptic={latestHaptic}
            profile={speakerProfile}
            onSwitchToAdmin={() => setViewMode("CAREGIVER_MASTER")}
          />
        )}

        {/* Mode 4: Advanced Admin & Active Learning Studio */}
        {viewMode === "ADVANCED_TRAINING" && (
          <>
            {adminTab === "dialects" && (
              <DialectActiveLearningStudio
                onRefreshGraph={() => {}}
              />
            )}

            {adminTab === "config" && (
              <AdminConfigPanel
                config={adminConfig}
                onUpdateConfig={setAdminConfig}
              />
            )}

            {adminTab === "terminal" && (
              <AudioVideoTerminal
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                useHighThinking={useHighThinking}
                offlineMode={offlineMode}
                latestHaptic={latestHaptic}
                profile={speakerProfile}
                onUpdateProfile={handleUpdateProfile}
                onOpenVoiceStudio={() => setAdminTab("voiceStudio")}
              />
            )}

            {adminTab === "voiceStudio" && (
              <VoiceTuningStudio
                profile={speakerProfile}
                onUpdateProfile={handleUpdateProfile}
              />
            )}

            {adminTab === "mesh" && (
              <EdgeNodesMesh
                nodes={nodes}
                onPingNode={handlePingNode}
                onAddNode={handleAddNode}
              />
            )}

            {adminTab === "haptics" && (
              <HapticPeripheralsPanel />
            )}

            {adminTab === "graph" && (
              <KnowledgeGraphViewer
                graphData={graphData}
                ragDocs={ragDocs}
                onAddGraphNode={handleAddGraphNode}
              />
            )}

            {adminTab === "microservices" && (
              <MicroservicesMonitor
                containers={containers}
                offlineMode={offlineMode}
                onToggleContainer={handleToggleContainer}
              />
            )}

            {adminTab === "extraction" && (
              <HostExtractionGuide
                adminConfig={adminConfig}
              />
            )}
          </>
        )}
      </main>

      {/* Bottom Status Bar */}
      <footer className="border-t border-slate-200 bg-white py-2.5 px-4 text-center text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-slate-700">VoiceFollower Host Master • server GPU locale</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono text-slate-600">
          <span>LAN .88: Connesso</span>
          <span>Realme GT 7 Pro: Attivo</span>
          <span>Sintesi Kokoro-82M: Pronta</span>
        </div>
      </footer>
    </div>
  );
}

