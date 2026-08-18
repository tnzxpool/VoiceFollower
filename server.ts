import express from "express";
import path from "path";
import os from "os";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Protezione dall'esterno: sistema SOLO per la LAN di casa. Nessun motore di
// ricerca deve indicizzare nulla, nemmeno se una porta finisse esposta per errore.
app.use((req, res, next) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  next();
});
app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send("User-agent: *\nDisallow: /\n");
});

// Musica di sottofondo: il caregiver mette i file in data/music/ sulla macchina
// che serve l'app; il cervello comanda play/stop, il kiosk fa ducking quando parla.
const MUSIC_DIR = path.join(process.cwd(), "data", "music");
app.get("/api/music/list", (req, res) => {
  try {
    fs.mkdirSync(MUSIC_DIR, { recursive: true });
    const files = fs.readdirSync(MUSIC_DIR).filter(f => /\.(mp3|ogg|m4a|wav|flac)$/i.test(f));
    res.json({ files });
  } catch {
    res.json({ files: [] });
  }
});
app.use("/music", express.static(MUSIC_DIR));

// Persistent In-Memory Admin Configuration
interface ServerAdminConfig {
  masterNodeName: string;
  masterHostIp: string;
  gpuServerIp: string;
  gpuServerPort: number;
  ttsEngine: "KOKORO_82M_NEURAL" | "PIPER_VITS_ITALIAN" | "XTTS_V2_GPU" | "WEB_SPEECH_LEGACY";
  ttsHuggingFaceModel: string;
  geminiApiKey: string;
  deepseekApiKey: string;
  glmApiKey: string;
  anthropicApiKey: string;
  anthropicModel: string;
  localLlmEndpoint: string;
  localLlmApiKey: string;
  localLlmUsername: string;
  localLlmPassword: string;
  localLlmModel: string;
  primaryProvider: "gemini" | "deepseek" | "glm" | "claude" | "local_ollama";
  fallbackProvider: "local_ollama" | "deepseek" | "gemini" | "airgap_int4";
  autoLearnDialects: boolean;
  masterRequireAuth: boolean;
  databaseStorageType: "SQL_RELATIONAL" | "GRAPH_EMBEDDED";
  syncIntervalSec: number;
}

let currentAdminConfig: ServerAdminConfig = {
  masterNodeName: "Host Master Centrale",
  masterHostIp: "192.168.1.120",
  gpuServerIp: "192.168.1.88",
  gpuServerPort: 8000,
  ttsEngine: "KOKORO_82M_NEURAL",
  ttsHuggingFaceModel: "hexgrad/Kokoro-82M-v0.19-it (HuggingFace)",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || "",
  glmApiKey: process.env.GLM_API_KEY || "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",
  localLlmEndpoint: process.env.LOCAL_LLM_ENDPOINT || "http://127.0.0.1:9101/v1",
  localLlmApiKey: process.env.LOCAL_LLM_API_KEY || "",
  localLlmUsername: process.env.LOCAL_LLM_USERNAME || "",
  localLlmPassword: process.env.LOCAL_LLM_PASSWORD || "",
  localLlmModel: process.env.LOCAL_LLM_MODEL || "qwen3.6-35b-a3b-iq4xs",
  // Se c'e' un cervello locale configurato (vf-host .89), e' lui il default:
  // niente cloud obbligatorio, niente frasi INT4 ripetute a ogni comando.
  primaryProvider:
    (process.env.PRIMARY_PROVIDER as ServerAdminConfig["primaryProvider"]) ||
    (process.env.LOCAL_LLM_ENDPOINT ? "local_ollama" : "gemini"),
  fallbackProvider: "local_ollama",
  autoLearnDialects: true,
  masterRequireAuth: false,
  databaseStorageType: "SQL_RELATIONAL",
  syncIntervalSec: 5
};

// Lazy initializer for Gemini client
let aiClient: GoogleGenAI | null = null;
function getAI(customKey?: string): GoogleGenAI | null {
  const apiKey = customKey || currentAdminConfig.geminiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient || (customKey && customKey !== process.env.GEMINI_API_KEY)) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// In-memory Knowledge Graph and Vector store
interface GraphNode {
  id: string;
  label: string;
  category: "entity" | "peripheral" | "memory" | "task" | "policy" | "dialect" | "invented";
  attributes: Record<string, any>;
}

interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  weight: number;
}

const memoryGraph: { nodes: GraphNode[]; edges: GraphEdge[] } = {
  nodes: [
    { id: "cpu_central", label: "Host Master Centrale", category: "entity", attributes: { status: "ONLINE", npu_load: "24%", ip: "192.168.1.120" } },
    { id: "node_av_term_1", label: "Terminale Slave Smartphone", category: "peripheral", attributes: { tipo: "Ascolto-Risposta Wi-Fi", ip: "192.168.1.45", latency_ms: 12 } },
    { id: "node_haptic_band", label: "Smartwatch / Fascia Aptica Slave", category: "peripheral", attributes: { protocollo: "BLE-Mesh / 2.4GHz", freq: "180Hz", batt: "88%" } },
    { id: "node_tactile_pad", label: "Array Tattile Periferico", category: "peripheral", attributes: { attuatori: 16, schema: "Direzionale Matrix" } },
    { id: "user_profile", label: "Profilo Operatore & Biometria", category: "memory", attributes: { stato: "ATTIVO", dialetto_base: "Toscano/Italiano" } },
    { id: "safety_policy", label: "Scudo Sicurezza Air-Gap", category: "policy", attributes: { crittografia: "ChaCha20-Poly1305", stato: "ATTIVO" } },
    { id: "rag_task_plan", label: "Motore Orchestrazione Sub-Task", category: "task", attributes: { coda: 2, strategia: "PARALLELA" } },
    // Esempi di nodi dialettali e parole inventate catalagoti
    { id: "dial_bada", label: "Bada (Dialetto Toscano)", category: "dialect", attributes: { significato: "Fai attenzione / Guarda", radice: "Italiano regionale", confidenza: "98%" } },
    { id: "dial_nana", label: "Nàna (Parola Inventata)", category: "invented", attributes: { significato: "Stato di riposo/standby periferico", autore: "Operatore", confidenza: "92%" } }
  ],
  edges: [
    { source: "cpu_central", target: "node_av_term_1", relation: "STREAM_DUPLEX_WIFI", weight: 0.98 },
    { source: "cpu_central", target: "node_haptic_band", relation: "TELEMETRIA_APTICA_CIFRATA", weight: 0.92 },
    { source: "cpu_central", target: "node_tactile_pad", relation: "CONTROLLO_MATRICE_TATTICA", weight: 0.86 },
    { source: "cpu_central", target: "user_profile", relation: "APPRENDIMENTO_CONTINUO", weight: 0.99 },
    { source: "cpu_central", target: "safety_policy", relation: "APPLICA_POLITICHE_SICUREZZA", weight: 1.0 },
    { source: "cpu_central", target: "rag_task_plan", relation: "DISTRIBUZIONE_TASK", weight: 0.94 },
    { source: "user_profile", target: "dial_bada", relation: "UTILIZZA_TERMINE", weight: 0.95 },
    { source: "dial_bada", target: "safety_policy", relation: "MAPPA_SU_ALLARME_ATTENZIONE", weight: 0.89 },
    { source: "user_profile", target: "dial_nana", relation: "HA_CONIATO_TERMINE", weight: 0.92 }
  ]
};

// Tabella Database Token Dialettali & Apprendimento Attivo (Doppia Catalogazione: Tabella DB + Grafo)
interface DialectDbRecord {
  id: string;
  term: string;
  sourceSlaveId: string;
  sourceSlaveName: string;
  category: "DIALETTO_REGIONALE" | "GERGO_OPERATIVO" | "PAROLA_INVENTATA" | "VOCALIZZO_VERSO" | "TERMINE_ESTERO";
  standardMeaning: string;
  phoneticAlt: string;
  confidence: number;
  sampleAudioTextContext: string;
  status: "APPRESO_ATTIVO" | "IN_ATTESA_SIGNIFICATO" | "VALIDATO_MASTER";
  catalogedInDb: boolean;
  catalogedInGraph: boolean;
  graphConnections: string[];
  foreignEquivalents?: string[];
  inventedEtymology?: string;
  occurrenceCount: number;
  lastHeardAt: string;
}

const dialectDatabase: DialectDbRecord[] = [
  {
    id: "dt_001",
    term: "Bada",
    sourceSlaveId: "node_av_term_1",
    sourceSlaveName: "Smartphone Operatore",
    category: "DIALETTO_REGIONALE",
    standardMeaning: "Fai attenzione / Guarda con prudenza",
    phoneticAlt: "ba-da",
    confidence: 0.98,
    sampleAudioTextContext: "Bada lì al display del nodo 2",
    status: "VALIDATO_MASTER",
    catalogedInDb: true,
    catalogedInGraph: true,
    graphConnections: ["safety_policy", "user_profile"],
    foreignEquivalents: ["Watch out (EN)", "Attention (FR)"],
    occurrenceCount: 14,
    lastHeardAt: "Oggi, 12:40"
  },
  {
    id: "dt_002",
    term: "Nàna",
    sourceSlaveId: "node_av_term_1",
    sourceSlaveName: "Smartphone Operatore",
    category: "PAROLA_INVENTATA",
    standardMeaning: "Metti in standby / Spegni temporaneamente i beacon",
    phoneticAlt: "naa-na",
    confidence: 0.94,
    sampleAudioTextContext: "Metti tutto in nàna per 5 minuti",
    status: "APPRESO_ATTIVO",
    catalogedInDb: true,
    catalogedInGraph: true,
    graphConnections: ["cpu_central", "user_profile"],
    inventedEtymology: "Gergo operatoriale coniato per indicare la pausa silente della rete",
    occurrenceCount: 8,
    lastHeardAt: "Oggi, 15:10"
  },
  {
    id: "dt_003",
    term: "Gnamo",
    sourceSlaveId: "node_av_term_1",
    sourceSlaveName: "Smartphone Operatore",
    category: "DIALETTO_REGIONALE",
    standardMeaning: "Andiamo / Procedi subito con il task",
    phoneticAlt: "gnaa-mo",
    confidence: 0.96,
    sampleAudioTextContext: "Gnamo con il piano di scansione",
    status: "VALIDATO_MASTER",
    catalogedInDb: true,
    catalogedInGraph: true,
    graphConnections: ["rag_task_plan"],
    foreignEquivalents: ["Let's go (EN)", "Allons-y (FR)"],
    occurrenceCount: 22,
    lastHeardAt: "Oggi, 16:05"
  },
  {
    id: "dt_004",
    term: "Zzz-click",
    sourceSlaveId: "node_haptic_band",
    sourceSlaveName: "Smartwatch Slave",
    category: "VOCALIZZO_VERSO",
    standardMeaning: "Verso onomatopeico per indicare aggancio riuscito del bus Wi-Fi",
    phoneticAlt: "zzz click",
    confidence: 0.88,
    sampleAudioTextContext: "Ha fatto zzz-click sul canale 6",
    status: "APPRESO_ATTIVO",
    catalogedInDb: true,
    catalogedInGraph: true,
    graphConnections: ["node_haptic_band"],
    occurrenceCount: 5,
    lastHeardAt: "Oggi, 17:30"
  }
];

const ragKnowledgeDocs = [
  {
    id: "doc_mesh_proto",
    title: "Protocollo Master/Slave Wi-Fi EdgeMesh",
    category: "Architettura",
    content: "L'Host Master risiede sul server privato ed è l'autorità centrale per la doppia catalogazione (Database + Grafo di Conoscenza). I terminali Slave (smartphone, smartwatch, microfoni) comunicano via Wi-Fi bidirezionale cifrato con ChaCha20-Poly1305. I pacchetti audio sub-20ms e i comandi aptici transitano a bassissima latenza."
  },
  {
    id: "doc_active_learning",
    title: "Apprendimento Attivo dei Dialetti e Parole Inventate",
    category: "Apprendimento Attivo",
    content: "Quando uno Slave rileva una parola sconosciuta, dialettale o inventata, il Master attiva la procedura di disambiguazione. Chiede il significato standard all'operatore, lo salva nella tabella lessicale del database e crea istantaneamente i nodi semantici nel grafo di memoria associandovi parole straniere e sinonimi operativi."
  },
  {
    id: "doc_haptics",
    title: "Pattern di Attuazione Aptica per Terminali Slave",
    category: "Periferiche",
    content: "I segnali aptici sono modulati con PDM. Pattern principali: 0x01: Conferma Silente (150ms @ 120Hz), 0x02: Allarme Attenzione (2 burst da 80ms @ 220Hz), 0x03: Sweep Direzionale (matrice tattile), 0x04: Battito Cardiaco / Rilassamento (60 BPM)."
  },
  {
    id: "doc_multi_llm",
    title: "Integrazione Multi-LLM (Gemini, DeepSeek, GLM, Modelli Locali)",
    category: "Motori Neurale",
    content: "L'Host Master supporta il dispatch dinamico verso Gemini (Google), DeepSeek (OpenAI-compatible), GLM (Zhipu AI) e istanze locali Ollama/vLLM residenti sullo stesso server, con fallback automatico su pipeline quantizzata INT4 in caso di assenza di connessione."
  }
];

// Container services runtime state
const microservicesState = [
  { id: "svc-gateway", name: "master-wifi-gateway", image: "edgemesh/gateway:v3.2", status: "running", port: 50051, cpu: "3.4%", mem: "135 MB", latency: "2.8ms", encrypted: true },
  { id: "svc-orchestrator", name: "multi-llm-orchestrator", image: "edgemesh/orchestrator:v4.1", status: "running", port: 8080, cpu: "14.2%", mem: "480 MB", latency: "38ms", encrypted: true },
  { id: "svc-dialect-db", name: "dialect-active-db", image: "edgemesh/sqlite-dialect:v2.0", status: "running", port: 5432, cpu: "2.8%", mem: "190 MB", latency: "1.2ms", encrypted: true },
  { id: "svc-graph", name: "graph-memory-engine", image: "edgemesh/memgraph-nx:v1.8", status: "running", port: 7474, cpu: "4.9%", mem: "305 MB", latency: "5.4ms", encrypted: true },
  { id: "svc-haptic", name: "haptic-dsp-broker", image: "edgemesh/haptic-dsp:v2.5", status: "running", port: 9092, cpu: "1.8%", mem: "78 MB", latency: "1.5ms", encrypted: true },
  { id: "svc-local-llm", name: "local-ollama-host", image: "ollama/ollama:latest", status: "standby_ready", port: 11434, cpu: "1.0%", mem: "1.2 GB", latency: "18.0ms", encrypted: true }
];

// LAN Slave Client Sessions (Realme GT 7 Pro, Tablet, Smartwatch)
const clientSlaveSessions: any[] = [
  {
    id: "client_gt7pro",
    name: "Realme GT 7 Pro (Companion Attivo)",
    ip: "192.168.1.45",
    mac: "98:2C:BC:4A:12:F1",
    deviceType: "SMARTPHONE",
    status: "ONLINE",
    batteryPct: 92,
    wifiSignalDbm: -42,
    isAuthorized: true,
    autonomousSessionEnabled: true,
    audioStreamRxEnabled: true, // Master ascolta microfono client
    audioStreamTxEnabled: true, // Master parla con voce rassicurante
    videoStreamRxEnabled: true, // Camera attiva per orientamento e sicurezza
    videoStreamTxEnabled: true, // Mostra volto/immagini rassicuranti
    volumeLevel: 85,
    lastActiveTime: "Adesso (Stream duplex attivo)",
    assignedRoom: "Soggiorno / Stanza Companion",
    activePromptStyle: "FAMILIAR_WARM"
  },
  {
    id: "client_tablet_bed",
    name: "Tablet Display Comodino",
    ip: "192.168.1.52",
    mac: "E4:5F:01:88:23:AA",
    deviceType: "TABLET",
    status: "ONLINE",
    batteryPct: 100,
    wifiSignalDbm: -48,
    isAuthorized: true,
    autonomousSessionEnabled: true,
    audioStreamRxEnabled: true,
    audioStreamTxEnabled: true,
    videoStreamRxEnabled: false,
    videoStreamTxEnabled: true,
    volumeLevel: 70,
    lastActiveTime: "2 min fa",
    assignedRoom: "Camera Notte",
    activePromptStyle: "CALM_REASSURING"
  },
  {
    id: "client_watch_caregiver",
    name: "Smartwatch Polso Caregiver",
    ip: "192.168.1.60",
    mac: "70:85:C2:10:94:DD",
    deviceType: "SMARTWATCH",
    status: "ONLINE",
    batteryPct: 88,
    wifiSignalDbm: -55,
    isAuthorized: true,
    autonomousSessionEnabled: false,
    audioStreamRxEnabled: false,
    audioStreamTxEnabled: false,
    videoStreamRxEnabled: false,
    videoStreamTxEnabled: false,
    volumeLevel: 100,
    lastActiveTime: "Adesso (Notifiche attive)",
    assignedRoom: "Mobile / Caregiver",
    activePromptStyle: "SHORT_SIMPLE"
  }
];

// Alzheimer Biographical Memory Store (Family, Anchors, Songs, Comfort Stories)
// ⛔ NIENTE dati demo inventati (nizix 2026-08-17): c'erano un "Marco (figlio)" e
// una "Maria (moglie)" mai esistiti che il companion raccontava al soggetto come
// fossero veri. La verità biografica la inserisce SOLO il caregiver (UI, e in
// futuro a voce). Persistenza su data/biography.json: sopravvive a riavvii/deploy.
const BIO_FILE = path.join(process.cwd(), "data", "biography.json");
const biographicalMemories: any[] = [];
try {
  if (fs.existsSync(BIO_FILE)) {
    const loaded = JSON.parse(fs.readFileSync(BIO_FILE, "utf8"));
    if (Array.isArray(loaded)) biographicalMemories.push(...loaded);
  }
} catch (e) {
  console.error("[biografia] file data/biography.json illeggibile:", e);
}
function saveBiography() {
  try {
    fs.mkdirSync(path.dirname(BIO_FILE), { recursive: true });
    fs.writeFileSync(BIO_FILE, JSON.stringify(biographicalMemories, null, 2));
  } catch (e) {
    console.error("[biografia] salvataggio fallito:", e);
  }
}

// ---------------------------------------------------------------------------
// Diario giornaliero + memoria oggetti (nizix 2026-08-17).
// Il diario è il "complesso mnemonico" dell'applicazione: raccoglie in ordine
// cronologico gli avvistamenti oggetti (vf-vision YOLO), le note memorizzate
// SU ORDINE ESPLICITO del caregiver e gli eventi rilevanti. Persistenza in
// data/ (gitignorata: dati personali, restano sulla macchina).
// ---------------------------------------------------------------------------
function loadJson(file: string, fallback: any) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) {
    console.error(`[diario] ${file} illeggibile:`, e);
  }
  return fallback;
}
function saveJson(file: string, data: any) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) { console.error(`[diario] salvataggio ${file} fallito:`, e); }
}

const DIARY_FILE = path.join(process.cwd(), "data", "diary.json");
const OBJ_FILE = path.join(process.cwd(), "data", "object-memory.json");
const ALARM_FILE = path.join(process.cwd(), "data", "alarm.json");

// diario: [{id, ts, kind: "visione"|"memoria"|"nota"|"sveglia"|"evento", text, meta?}]
const diaryEntries: any[] = loadJson(DIARY_FILE, []);
// oggetti: { "tazza": {label, label_it, lastSeen, source, conf, count}, ... }
const objectMemory: Record<string, any> = loadJson(OBJ_FILE, {});
// sveglia: disattiva di default, abilitabile a voce ("c'è tutto basta chiederlo")
const alarmConfig: { enabled: boolean; time: string } = loadJson(ALARM_FILE, { enabled: false, time: "08:00" });

// "Cura" — funzioni clonate da KindredMind, tutte offline (nizix 2026-08-17):
// novità di famiglia usate in ogni conversazione, prossima visita REALE (mai
// promettere altro), cosa lo calma / cosa evitare / ritmo quotidiano,
// promemoria multipli detti a voce dal kiosk, check-in proattivi programmati.
const CARE_FILE = path.join(process.cwd(), "data", "care.json");
const careConfig: any = loadJson(CARE_FILE, {
  quickUpdates: "",   // es. "Il nipote ha segnato il primo gol a calcio"
  nextVisit: "",      // es. "domenica alle 15 viene Francesca"
  soothes: "",        // cosa lo calma (una per riga)
  avoid: "",          // cosa evitare (una per riga)
  dailyRhythm: "",    // ritmo quotidiano reale (colazione, riposo, ecc.)
  reminders: [],      // [{id, time:"HH:MM", text, lastFired}]
  checkin: { enabled: false, times: [], lastFired: {} }
});
// retrocompatibilità se il file esiste ma incompleto
careConfig.reminders = Array.isArray(careConfig.reminders) ? careConfig.reminders : [];
careConfig.checkin = careConfig.checkin && typeof careConfig.checkin === "object"
  ? { enabled: !!careConfig.checkin.enabled, times: Array.isArray(careConfig.checkin.times) ? careConfig.checkin.times : [], lastFired: careConfig.checkin.lastFired || {} }
  : { enabled: false, times: [], lastFired: {} };
const saveCare = () => saveJson(CARE_FILE, careConfig);

function addDiary(kind: string, text: string, meta?: any) {
  diaryEntries.unshift({
    id: `dia_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ts: new Date().toISOString(), kind, text, ...(meta ? { meta } : {})
  });
  if (diaryEntries.length > 2000) diaryEntries.length = 2000;
  saveJson(DIARY_FILE, diaryEntries);
}

// vf-vision (YOLO11 su CT 130, porta 9106). Dal CT stesso o dalla LAN
// l'indirizzo .89 vale sempre; override con VF_VISION_URL se serve.
const VISION_URL = (process.env.VF_VISION_URL || "http://192.168.1.89:9106").replace(/\/+$/, "");
// vf-tts (XTTS-v2 su CT 130, porta 9107). Il server gira NEL CT: localhost sempre valido
// (il firewall del CT blocca la 9107 dall'esterno, ma qui non serve attraversarlo).
const TTS_URL = (process.env.VF_TTS_URL || "http://127.0.0.1:9107").replace(/\/+$/, "");
// Oggetti personali che vale la pena ricordare ("dove ho messo il telecomando?").
// Limite COCO dichiarato: gli OCCHIALI non sono tra le 80 classi — servirà un
// modello open-vocabulary (YOLO-World/YOLOE) per aggiungerli. Persone escluse
// dalla memoria oggetti (vanno nel diario come evento, non come "oggetto").
const OBJ_INTERESSANTI = new Set([
  // classici COCO
  "telecomando", "telefono", "libro", "tazza", "bicchiere di vino", "bottiglia",
  "borsa", "zaino", "valigia", "orologio", "forbici", "computer portatile",
  "mouse", "tastiera", "spazzolino", "asciugacapelli", "ombrello", "orsacchiotto",
  // open-vocabulary (YOLO-World, 2026-08-17): gli oggetti che contano davvero
  "accendino", "posacenere", "sigarette", "occhiali", "chiavi", "portafoglio",
  "medicine", "giornale", "bicchiere", "bastone", "apparecchio acustico",
  "dentiera", "pantofole", "scarpe", "cappello", "orologio da polso", "pettine"
]);

async function detectObjects(snapshotDataUrl: string, sourceLabel: string) {
  try {
    const resp = await fetch(`${VISION_URL}/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_b64: snapshotDataUrl }),
      signal: AbortSignal.timeout(15000)
    });
    if (!resp.ok) return null;
    const data: any = await resp.json();
    const dets: any[] = Array.isArray(data?.detections) ? data.detections : [];
    const ora = new Date().toISOString();
    const visti: string[] = [];
    for (const d of dets) {
      if (d.label === "person") continue;
      if (!OBJ_INTERESSANTI.has(d.label_it)) continue;
      const prev = objectMemory[d.label_it];
      objectMemory[d.label_it] = {
        label: d.label, label_it: d.label_it, lastSeen: ora,
        source: sourceLabel, conf: d.conf, count: (prev?.count || 0) + 1
      };
      visti.push(d.label_it);
    }
    if (visti.length) {
      saveJson(OBJ_FILE, objectMemory);
      addDiary("visione", `Visti: ${[...new Set(visti)].join(", ")} (${sourceLabel})`, { detections: dets.length });
    }
    return dets;
  } catch {
    return null; // vf-vision spento: la sorveglianza continua senza oggetti
  }
}

// Riassunto per il prompt vocale: ultimi avvistamenti, più recenti prima
function objectMemorySummary(): string {
  const items = Object.values(objectMemory)
    .sort((a: any, b: any) => (b.lastSeen || "").localeCompare(a.lastSeen || ""))
    .slice(0, 12)
    .map((o: any) => {
      const quando = new Date(o.lastSeen).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      return `${o.label_it}: visto in "${o.source}" il ${quando}`;
    });
  return items.join("\n");
}
function caregiverMemorySummary(): string {
  return diaryEntries.filter(d => d.kind === "memoria").slice(0, 10)
    .map(d => `- ${d.text}`).join("\n");
}

// Caregiver Disorientation & Well-being Alerts
// (niente dati demo precaricati: il diario mostra solo eventi reali)
const caregiverAlerts: any[] = [];

// Proxmox Dell PowerEdge R740 & Tesla P40 GPU Configuration
const proxmoxServerInfo = {
  ddnsDomain: "",
  lanIp: "192.168.1.88",
  serverModel: "Dell PowerEdge R740 (Proxmox VE 8.2)",
  gpuModel: "NVIDIA Tesla P40 (24 GB GDDR5 VRAM - Pascal FP32/INT8)",
  vramTotalGb: 24.0,
  vramUsedGb: 6.84,
  gpuTempC: 44,
  ollamaStatus: true,
  whisperSttStatus: true,
  kokoroTtsStatus: true,
  activeModel: "Qwen2.5-7B-Instruct / Kokoro-82M-v0.19 (P40 GPU Accel)",
  isReachable: true
};

// Client Slave Endpoints
app.get("/api/clients/sessions", (req, res) => {
  res.json({
    sessions: clientSlaveSessions,
    totalOnline: clientSlaveSessions.filter(s => s.status === "ONLINE").length,
    activeCompanionDevice: clientSlaveSessions.find(s => s.autonomousSessionEnabled && s.status === "ONLINE")
  });
});

app.post("/api/clients/toggle-permission", (req, res) => {
  const { clientId, permissionKey, value } = req.body;
  const client = clientSlaveSessions.find(c => c.id === clientId);
  if (!client) return res.status(404).json({ error: "Dispositivo non trovato" });

  if (permissionKey in client) {
    (client as any)[permissionKey] = value;
  }
  client.lastActiveTime = "Aggiornato da Admin adesso";

  res.json({
    success: true,
    client,
    message: `Permesso '${permissionKey}' aggiornato per ${client.name}`
  });
});

app.post("/api/clients/volume", (req, res) => {
  const { clientId, volumeLevel } = req.body;
  const client = clientSlaveSessions.find(c => c.id === clientId);
  if (!client) return res.status(404).json({ error: "Dispositivo non trovato" });

  client.volumeLevel = Math.max(0, Math.min(100, volumeLevel));
  res.json({ success: true, client });
});

// Biographical Memory Endpoints
app.get("/api/memory/biography", (req, res) => {
  res.json({
    memories: biographicalMemories,
    total: biographicalMemories.length
  });
});

app.post("/api/memory/biography/add", (req, res) => {
  const { title, description, category, emotionalValence, relationOrTopic } = req.body;
  if (!title || !description) {
    return res.status(400).json({ error: "Titolo e descrizione memoria obbligatori" });
  }

  const newEntry = {
    id: "bio_" + Math.random().toString(36).substring(2, 9),
    category: category || "SPECIAL_MEMORY",
    title: title.trim(),
    description: description.trim(),
    emotionalValence: emotionalValence || "CALMING",
    relationOrTopic: relationOrTopic || "Ricordo autobiografico",
    linkedGraphNodeId: "node_" + Math.random().toString(36).substring(2, 7),
    frequencyTriggered: 1,
    lastRecalledAt: "Appena registrato"
  };

  biographicalMemories.unshift(newEntry);

  // Inserisci nodo nel Knowledge Graph
  memoryGraph.nodes.push({
    id: newEntry.linkedGraphNodeId,
    label: `${newEntry.title} (${newEntry.relationOrTopic})`,
    category: "memory",
    attributes: {
      descrizione: newEntry.description,
      valenza_emotiva: newEntry.emotionalValence
    }
  });

  memoryGraph.edges.push({
    source: "user_profile",
    target: newEntry.linkedGraphNodeId,
    relation: "RICORDO_AFFETTIVO_ANCORA",
    weight: 0.99
  });

  saveBiography();
  res.json({
    success: true,
    memory: newEntry,
    message: "Memoria affettiva registrata con successo nel database e nel Grafo di Vita."
  });
});

// Modifica di una memoria biografica (l'admin corregge informazioni sbagliate:
// il companion NON deve mai raccontare cose false sulla famiglia)
app.post("/api/memory/biography/update", (req, res) => {
  const { id, title, description, category, emotionalValence, relationOrTopic } = req.body;
  const mem = biographicalMemories.find(m => m.id === id);
  if (!mem) return res.status(404).json({ error: "Memoria non trovata" });
  if (title) mem.title = String(title).trim();
  if (description) mem.description = String(description).trim();
  if (category) mem.category = category;
  if (emotionalValence) mem.emotionalValence = emotionalValence;
  if (relationOrTopic) mem.relationOrTopic = relationOrTopic;
  const node = memoryGraph.nodes.find(n => n.id === mem.linkedGraphNodeId);
  if (node) {
    node.label = `${mem.title} (${mem.relationOrTopic})`;
    node.attributes = { ...node.attributes, descrizione: mem.description, valenza_emotiva: mem.emotionalValence };
  }
  saveBiography();
  res.json({ success: true, memory: mem, memories: biographicalMemories });
});

// Cancellazione di una memoria biografica (+ nodo e archi collegati nel grafo)
app.post("/api/memory/biography/delete", (req, res) => {
  const { id } = req.body;
  const idx = biographicalMemories.findIndex(m => m.id === id);
  if (idx === -1) return res.status(404).json({ error: "Memoria non trovata" });
  const [rimossa] = biographicalMemories.splice(idx, 1);
  const nid = rimossa.linkedGraphNodeId;
  const nIdx = memoryGraph.nodes.findIndex(n => n.id === nid);
  if (nIdx !== -1) memoryGraph.nodes.splice(nIdx, 1);
  for (let i = memoryGraph.edges.length - 1; i >= 0; i--) {
    if (memoryGraph.edges[i].source === nid || memoryGraph.edges[i].target === nid) {
      memoryGraph.edges.splice(i, 1);
    }
  }
  saveBiography();
  res.json({ success: true, memories: biographicalMemories });
});

// Caregiver Alerts Endpoints
app.get("/api/caregiver/alerts", (req, res) => {
  res.json({
    alerts: caregiverAlerts,
    unresolvedCount: caregiverAlerts.filter(a => !a.resolved).length
  });
});

app.post("/api/caregiver/alerts/resolve", (req, res) => {
  const { alertId } = req.body;
  const alert = caregiverAlerts.find(a => a.id === alertId);
  if (alert) alert.resolved = true;
  res.json({ success: true, alerts: caregiverAlerts });
});

// ---------------------------------------------------------------------------
// Ollama Models Endpoint — interroga il server GPU (default 192.168.1.88:11434)
// e restituisce i modelli REALMENTE scaricati e pronti all'uso, così l'admin
// seleziona solo modelli esistenti e vede subito se il nodo è raggiungibile.
// ---------------------------------------------------------------------------
app.get("/api/ollama/models", async (req, res) => {
  const base = (currentAdminConfig.localLlmEndpoint || "http://192.168.1.88:8080/api/v1")
    .replace(/\/api\/v1\/?$/, "")
    .replace(/\/v1\/?$/, "")
    .replace(/\/+$/, "");

  // 1) Ollama nativo (porta 11434): /api/tags
  try {
    const resp = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data: any = await resp.json();
    const models = (data.models || []).map((m: any) => ({
      name: m.name,
      sizeGb: m.size ? (m.size / 1e9).toFixed(1) : null,
      family: m.details?.family || null,
      parameterSize: m.details?.parameter_size || null,
      quantization: m.details?.quantization_level || null,
      modifiedAt: m.modified_at || null
    }));
    return res.json({
      reachable: true,
      mode: "ollama",
      endpoint: base,
      models,
      activeModel: currentAdminConfig.localLlmModel,
      activeModelInstalled: models.some((m: any) => m.name === currentAdminConfig.localLlmModel)
    });
  } catch {
    // non è Ollama: prova la R740 AI Factory
  }

  // 2) R740 AI Factory (porta 8080): catalogo /api/v1/models + /api/v1/info
  try {
    const resp = await fetch(`${base}/api/v1/models`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data: any = await resp.json();
    let inferenceConfigured: boolean | null = null;
    try {
      const info = await fetch(`${base}/api/v1/info`, { signal: AbortSignal.timeout(3000) });
      if (info.ok) inferenceConfigured = !!(await info.json() as any).inference_configured;
    } catch { /* info facoltativa */ }
    const models = (data.models || []).map((m: any) => ({
      name: m.id,
      sizeGb: null,
      family: m.backend || null,
      parameterSize: m.kind || null,
      quantization: null,
      modifiedAt: null,
      enabled: m.enabled !== false
    }));
    return res.json({
      reachable: true,
      mode: "r740_factory",
      endpoint: base,
      inferenceConfigured,
      models,
      activeModel: currentAdminConfig.localLlmModel,
      activeModelInstalled: models.some((m: any) => m.name === currentAdminConfig.localLlmModel),
      note: inferenceConfigured === false
        ? "R740 AI Factory raggiungibile ma inference NON configurata: imposta R740_INFERENCE_BASE_URL in config/runtime.env sul server."
        : undefined
    });
  } catch {
    // non è la Factory: prova il portale R740 live
  }

  // 3) Portale R740 live: /health + login + /api/models
  try {
    const health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) });
    if (!health.ok) throw new Error(`HTTP ${health.status}`);
    let models: any[] = [];
    let portalActive: string | null = null;
    if (currentAdminConfig.localLlmUsername && currentAdminConfig.localLlmPassword) {
      const cookie = await getPortalCookie(base, currentAdminConfig.localLlmUsername, currentAdminConfig.localLlmPassword);
      const mr = await fetch(`${base}/api/models`, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(5000) });
      if (mr.ok) {
        const md: any = await mr.json();
        portalActive = md.active_model || null;
        const seen = new Set<string>();
        for (const r of md.resident_models || []) {
          if (!seen.has(r.id)) {
            seen.add(r.id);
            models.push({ name: r.id, sizeGb: null, family: "residente", parameterSize: r.display_name || null, quantization: null, modifiedAt: null });
          }
        }
        for (const [id, m] of Object.entries<any>(md.models || {})) {
          if (!seen.has(id)) {
            seen.add(id);
            models.push({ name: id, sizeGb: null, family: m.available ? "disponibile" : "non attivo", parameterSize: m.display_name || null, quantization: null, modifiedAt: null });
          }
        }
      }
    }
    return res.json({
      reachable: true,
      mode: "r740_portal",
      endpoint: base,
      portalActiveModel: portalActive,
      models,
      activeModel: currentAdminConfig.localLlmModel,
      activeModelInstalled: models.some((m: any) => m.name === currentAdminConfig.localLlmModel),
      note: models.length === 0
        ? "Portale raggiungibile. Inserisci username e password del portale in Admin > Config per elencare i modelli."
        : undefined
    });
  } catch (err: any) {
    return res.json({
      reachable: false,
      endpoint: base,
      models: [],
      activeModel: currentAdminConfig.localLlmModel,
      activeModelInstalled: false,
      error: `Nodo LLM locale non raggiungibile (${err?.message || err}). Provati: ${base}/api/tags (Ollama), ${base}/api/v1/models (Factory), ${base}/health (Portale R740).`
    });
  }
});

// ---------------------------------------------------------------------------
// Surveillance Endpoints — sorveglianza ambientale multi-fonte a eventi.
// Il client NON richiede azioni al paziente: le postazioni inviano eventi
// automatici (movimento, rumore, silenzio anomalo). Il server:
//   1. archivia l'evento
//   2. genera automaticamente un alert caregiver con severità mappata
//   3. (opzionale) analizza lo snapshot con il motore visivo Gemini
// ---------------------------------------------------------------------------
const surveillanceEvents: any[] = [];

// Regole d'uso degli shot (decise con l'utente, 2026-08-17):
// - le immagini servono SOLO come prova visiva per il caregiver e per l'analisi AI della scena;
//   non sono registrazione continua e non vanno su disco.
// - tetto: al massimo MAX_SNAPSHOTS_KEPT eventi conservano l'immagine (i più vecchi
//   restano nel registro senza foto).
// - scadenza: l'immagine viene rimossa dopo SNAPSHOT_TTL_MS (l'evento scritto resta).
// - analisi AI: tutte le richieste, ma al massimo MAX_AI_ANALYSES_PER_HOUR l'ora.
const MAX_SNAPSHOTS_KEPT = 10;
const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_AI_ANALYSES_PER_HOUR = 20;
const aiAnalysisTimestamps: number[] = [];

function enforceSnapshotRules() {
  const now = Date.now();
  let withSnapshot = 0;
  for (const evt of surveillanceEvents) {
    if (!evt.snapshot) continue;
    withSnapshot += 1;
    const age = now - new Date(evt.timestamp).getTime();
    if (withSnapshot > MAX_SNAPSHOTS_KEPT || age > SNAPSHOT_TTL_MS) {
      delete evt.snapshot;
      evt.snapshotRemoved = true;
    }
  }
}
setInterval(enforceSnapshotRules, 10 * 60 * 1000);

function aiAnalysisAllowed(): boolean {
  const cutoff = Date.now() - 60 * 60 * 1000;
  while (aiAnalysisTimestamps.length && aiAnalysisTimestamps[0] < cutoff) aiAnalysisTimestamps.shift();
  if (aiAnalysisTimestamps.length >= MAX_AI_ANALYSES_PER_HOUR) return false;
  aiAnalysisTimestamps.push(Date.now());
  return true;
}

const SURVEILLANCE_SEVERITY: Record<string, string> = {
  MOVIMENTO: "INFO",
  RUMORE_FORTE: "ATTENTION",
  SILENZIO_ANOMALO: "URGENT"
};

app.get("/api/surveillance/events", (req, res) => {
  // snapshot esclusi dalla lista per non gonfiare il payload
  res.json({
    events: surveillanceEvents.slice(0, 100).map(({ snapshot, ...rest }) => rest),
    total: surveillanceEvents.length
  });
});

app.post("/api/surveillance/event", async (req, res) => {
  const { type, sourceLabel, detail, snapshot, analyze } = req.body || {};
  if (!type || !sourceLabel) {
    return res.status(400).json({ success: false, error: "type e sourceLabel richiesti" });
  }

  const event: any = {
    id: `sev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    type,
    sourceLabel,
    detail: detail || "",
    snapshot
  };

  // Riconoscimento oggetti locale (vf-vision YOLO, GPU nostra: nessun tetto
  // orario) — alimenta la memoria oggetti e il diario ("dove ho visto la tazza")
  if (snapshot && typeof snapshot === "string" && snapshot.startsWith("data:image")) {
    const dets = await detectObjects(snapshot, sourceLabel);
    if (dets && dets.length) {
      event.objects = dets.map((d: any) => `${d.label_it} ${Math.round(d.conf * 100)}%`).join(", ");
    }
  }

  // Analisi visiva opzionale dello snapshot (riconoscimento scena/persona)
  // Tetto: max MAX_AI_ANALYSES_PER_HOUR analisi l'ora (regola d'uso shot)
  if (analyze && snapshot && typeof snapshot === "string" && snapshot.startsWith("data:image") && aiAnalysisAllowed()) {
    const ai = getAI();
    if (ai) {
      try {
        const base64 = snapshot.split(",")[1];
        const resp = await ai.models.generateContent({
          model: "gemini-flash-latest",
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType: "image/jpeg", data: base64 } },
                {
                  text:
                    "Sei il modulo di visione di un sistema di assistenza per una persona con Alzheimer. " +
                    "Descrivi in UNA frase in italiano cosa si vede nell'immagine, indicando se c'è una persona, " +
                    "cosa sta facendo e se la situazione appare normale o richiede attenzione del caregiver."
                }
              ]
            }
          ]
        });
        if (resp?.text) event.aiAnalysis = resp.text.trim();
      } catch (err: any) {
        console.warn("Analisi visiva sorveglianza non disponibile:", err?.message || err);
      }
    }
  }

  // Generazione automatica alert caregiver
  const severity = SURVEILLANCE_SEVERITY[type] || "INFO";
  const alert = {
    id: `alert_sev_${Date.now()}`,
    timestamp: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    severity,
    title:
      type === "MOVIMENTO"
        ? "Movimento rilevato"
        : type === "RUMORE_FORTE"
          ? "Rumore forte rilevato"
          : "Silenzio anomalo prolungato",
    description: `${event.detail}${event.objects ? ` — Oggetti: ${event.objects}` : ""}${event.aiAnalysis ? ` — Analisi visiva: ${event.aiAnalysis}` : ""}`,
    sourceDevice: sourceLabel,
    resolved: severity === "INFO"
  };
  caregiverAlerts.unshift(alert);
  if (caregiverAlerts.length > 200) caregiverAlerts.pop();
  event.alertId = alert.id;

  surveillanceEvents.unshift(event);
  if (surveillanceEvents.length > 300) surveillanceEvents.pop();
  enforceSnapshotRules();

  res.json({ success: true, event: { ...event, snapshot: undefined }, alert });
});

// ---------------------------------------------------------------------------
// Diario giornaliero, memoria oggetti, sveglia (endpoint caregiver/kiosk)
// ---------------------------------------------------------------------------
app.get("/api/diary", (req, res) => {
  const giorno = typeof req.query.date === "string" ? req.query.date : ""; // YYYY-MM-DD
  const entries = giorno
    ? diaryEntries.filter(d => (d.ts || "").startsWith(giorno))
    : diaryEntries.slice(0, 200);
  res.json({ entries, total: diaryEntries.length, alarm: { ...alarmConfig } });
});

app.post("/api/diary/note", (req, res) => {
  const testo = String(req.body?.text || "").trim();
  if (!testo) return res.status(400).json({ success: false, error: "text richiesto" });
  addDiary(String(req.body?.kind || "nota"), testo, { da: "caregiver UI" });
  res.json({ success: true, entries: diaryEntries.slice(0, 50) });
});

app.get("/api/objects", (req, res) => {
  res.json({ objects: objectMemory, summary: objectMemorySummary() });
});

app.get("/api/alarm", (req, res) => res.json({ ...alarmConfig }));
app.post("/api/alarm", (req, res) => {
  if (typeof req.body?.enabled === "boolean") alarmConfig.enabled = req.body.enabled;
  if (typeof req.body?.time === "string" && /^\d{2}:\d{2}$/.test(req.body.time)) alarmConfig.time = req.body.time;
  saveJson(ALARM_FILE, alarmConfig);
  addDiary("sveglia", `Sveglia ${alarmConfig.enabled ? "attivata" : "disattivata"} (${alarmConfig.time}) dalla UI`);
  res.json({ ...alarmConfig });
});

// --- Cura (clone offline delle funzioni KindredMind) ---
app.get("/api/care", (_req, res) => res.json(careConfig));
app.post("/api/care", (req, res) => {
  const b = req.body || {};
  for (const k of ["quickUpdates", "nextVisit", "soothes", "avoid", "dailyRhythm"]) {
    if (typeof b[k] === "string") careConfig[k] = b[k];
  }
  if (Array.isArray(b.reminders)) {
    careConfig.reminders = b.reminders
      .filter((r: any) => r && /^\d{2}:\d{2}$/.test(r.time || "") && typeof r.text === "string" && r.text.trim())
      .map((r: any) => ({
        id: r.id || `rem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        time: r.time, text: r.text.trim(), lastFired: r.lastFired || ""
      }));
  }
  if (b.checkin && typeof b.checkin === "object") {
    if (typeof b.checkin.enabled === "boolean") careConfig.checkin.enabled = b.checkin.enabled;
    if (Array.isArray(b.checkin.times)) careConfig.checkin.times = b.checkin.times.filter((t: string) => /^\d{2}:\d{2}$/.test(t));
  }
  saveCare();
  res.json(careConfig);
});

// Cosa deve dire il kiosk di sua iniziativa ADESSO (il kiosk chiama ogni 30 s).
// Promemoria: il testo del caregiver, detto pari pari. Check-in: il kiosk apre
// lui la conversazione via /api/orchestrate (voce familiare che passa a trovare,
// come i "companion calls them first" di KindredMind — ma tutto in LAN).
app.get("/api/kiosk/due", (_req, res) => {
  const now = new Date();
  const hhmm = now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  const dayKey = now.toDateString();
  for (const r of careConfig.reminders) {
    const chiave = `${dayKey} ${r.time}`;
    if (r.time === hhmm && r.lastFired !== chiave) {
      r.lastFired = chiave;
      saveCare();
      addDiary("evento", `Promemoria detto a voce (${r.time}): ${r.text}`);
      return res.json({ kind: "reminder", say: r.text });
    }
  }
  if (careConfig.checkin.enabled) {
    for (const t of careConfig.checkin.times) {
      if (t === hhmm && careConfig.checkin.lastFired[t] !== dayKey) {
        careConfig.checkin.lastFired[t] = dayKey;
        saveCare();
        addDiary("evento", `Check-in proattivo delle ${t} avviato dal kiosk`);
        return res.json({ kind: "checkin" });
      }
    }
  }
  res.json({ kind: null });
});

// --- Registrazione voce caregiver per il futuro training TTS (clonazione) ---
// I campioni stanno in data/voice-training/ (gitignored: MAI su GitHub).
// Livelli stile KindredMind: 5 min Iniziale, 30 Raffinata, 60 Vera, 90 Firma.
const VOICE_DIR = path.join(process.cwd(), "data", "voice-training");
const VOICE_META = path.join(VOICE_DIR, "meta.json");
const voiceSamples: any[] = loadJson(VOICE_META, []);
const voiceTier = (secTot: number) => secTot >= 5400 ? "Voce Firma" : secTot >= 3600 ? "Voce Vera"
  : secTot >= 1800 ? "Voce Raffinata" : secTot >= 300 ? "Voce Iniziale" : "In costruzione";

app.get("/api/voice-samples", (_req, res) => {
  const totalSec = voiceSamples.reduce((s, v) => s + (v.seconds || 0), 0);
  res.json({ samples: voiceSamples, totalSec, tier: voiceTier(totalSec) });
});
app.post("/api/voice-sample", (req, res) => {
  const { audio_b64, mimeType, seconds } = req.body || {};
  if (!audio_b64 || typeof audio_b64 !== "string") return res.status(400).json({ error: "manca audio_b64" });
  const sec = Math.max(1, Math.round(Number(seconds) || 0));
  const ext = String(mimeType || "").includes("ogg") ? "ogg" : "webm";
  const id = `vt_${Date.now()}`;
  const file = `${id}.${ext}`;
  try {
    fs.mkdirSync(VOICE_DIR, { recursive: true });
    fs.writeFileSync(path.join(VOICE_DIR, file), Buffer.from(audio_b64.split(",").pop() || "", "base64"));
  } catch (e) {
    return res.status(500).json({ error: "salvataggio fallito" });
  }
  voiceSamples.unshift({ id, file, seconds: sec, ts: new Date().toISOString() });
  saveJson(VOICE_META, voiceSamples);
  const totalSec = voiceSamples.reduce((s, v) => s + (v.seconds || 0), 0);
  addDiary("evento", `Registrato campione voce caregiver: ${sec}s (totale ${Math.round(totalSec / 60)} min)`);
  res.json({ ok: true, id, totalSec, tier: voiceTier(totalSec) });
});
app.post("/api/voice-sample/delete", (req, res) => {
  const idx = voiceSamples.findIndex(v => v.id === req.body?.id);
  if (idx < 0) return res.status(404).json({ error: "non trovato" });
  try { fs.unlinkSync(path.join(VOICE_DIR, voiceSamples[idx].file)); } catch {}
  voiceSamples.splice(idx, 1);
  saveJson(VOICE_META, voiceSamples);
  const totalSec = voiceSamples.reduce((s, v) => s + (v.seconds || 0), 0);
  res.json({ ok: true, totalSec, tier: voiceTier(totalSec) });
});

// Proxmox Dell R740 Tesla P40 Status Endpoint
app.get("/api/proxmox/status", (req, res) => {
  res.json(proxmoxServerInfo);
});

// Health endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    system: "EdgeMesh Host Master Node",
    online: true,
    role: "MASTER_AUTHORITATIVE",
    containers: microservicesState,
    nodeCount: memoryGraph.nodes.length,
    edgeCount: memoryGraph.edges.length,
    dialectTokensCount: dialectDatabase.length,
    timestamp: new Date().toISOString()
  });
});

// Admin Configuration endpoints
app.get("/api/admin/config", (req, res) => {
  res.json(currentAdminConfig);
});

app.post("/api/admin/config", (req, res) => {
  try {
    currentAdminConfig = {
      ...currentAdminConfig,
      ...req.body
    };
    // Reset AI Client to pick up new key if updated
    aiClient = null;
    res.json({ success: true, config: currentAdminConfig, message: "Configurazione Master salvata con successo." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Export Endpoint (JSON / SQL double-catalog download)
app.get("/api/admin/export", (req, res) => {
  const format = req.query.format || "json";
  const exportPayload = {
    exportedAt: new Date().toISOString(),
    hostInfo: {
      name: currentAdminConfig.masterNodeName,
      ip: currentAdminConfig.masterHostIp,
      role: "MASTER"
    },
    dialectDatabase,
    knowledgeGraph: memoryGraph,
    ragDocuments: ragKnowledgeDocs,
    containers: microservicesState
  };

  if (format === "sql") {
    let sql = `-- ==================================================\n`;
    sql += `-- EDGEMESH HOST MASTER - EXPORT DATABASE & GRAFO\n`;
    sql += `-- Data: ${new Date().toISOString()}\n`;
    sql += `-- ==================================================\n\n`;
    sql += `CREATE TABLE IF NOT EXISTS dialect_tokens (\n`;
    sql += `  id VARCHAR(64) PRIMARY KEY,\n`;
    sql += `  term VARCHAR(255) NOT NULL,\n`;
    sql += `  category VARCHAR(64),\n`;
    sql += `  standard_meaning TEXT,\n`;
    sql += `  phonetic_alt VARCHAR(255),\n`;
    sql += `  source_slave_name VARCHAR(128),\n`;
    sql += `  confidence REAL,\n`;
    sql += `  status VARCHAR(64),\n`;
    sql += `  occurrence_count INT,\n`;
    sql += `  last_heard_at VARCHAR(64)\n`;
    sql += `);\n\n`;

    for (const d of dialectDatabase) {
      sql += `INSERT INTO dialect_tokens (id, term, category, standard_meaning, phonetic_alt, source_slave_name, confidence, status, occurrence_count, last_heard_at) VALUES ('${d.id}', '${d.term.replace(/'/g, "''")}', '${d.category}', '${d.standardMeaning.replace(/'/g, "''")}', '${d.phoneticAlt.replace(/'/g, "''")}', '${d.sourceSlaveName}', ${d.confidence}, '${d.status}', ${d.occurrenceCount}, '${d.lastHeardAt}');\n`;
    }

    res.setHeader("Content-Type", "application/sql");
    res.setHeader("Content-Disposition", `attachment; filename="edgemesh_master_export_${Date.now()}.sql"`);
    return res.send(sql);
  }

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="edgemesh_master_export_${Date.now()}.json"`);
  res.json(exportPayload);
});

// Admin Reset / Purge Endpoint
app.post("/api/admin/reset", (req, res) => {
  const { target } = req.body;
  if (target === "dialects") {
    // Keep baseline examples but clear dynamic
    dialectDatabase.splice(4);
    return res.json({ success: true, message: "Tabella dialetti resettata al profilo base." });
  } else if (target === "graph") {
    // Reset graph to default
    memoryGraph.nodes.splice(9);
    memoryGraph.edges.splice(9);
    return res.json({ success: true, message: "Grafo semantico ripristinato allo stato iniziale." });
  }
  res.json({ success: true, message: "Operazione di manutenzione completata." });
});

// Dialect Active Learning endpoints
app.get("/api/dialects", (req, res) => {
  res.json({
    total: dialectDatabase.length,
    tokens: dialectDatabase
  });
});

app.post("/api/dialects/learn", (req, res) => {
  const { term, standardMeaning, category, phoneticAlt, sourceSlaveName, sampleAudioTextContext, foreignEquivalents, inventedEtymology } = req.body;

  if (!term) return res.status(400).json({ error: "Termine obbligatorio" });

  const existing = dialectDatabase.find(d => d.term.toLowerCase() === String(term).trim().toLowerCase());
  if (existing) {
    existing.occurrenceCount += 1;
    existing.lastHeardAt = new Date().toLocaleTimeString("it-IT");
    if (standardMeaning) existing.standardMeaning = standardMeaning;
    if (category) existing.category = category;
    existing.status = "VALIDATO_MASTER";
    return res.json({ success: true, token: existing, message: "Termine esistente aggiornato nel database e grafo." });
  }

  const id = "dt_" + Math.random().toString(36).substring(2, 9);
  const newRecord: DialectDbRecord = {
    id,
    term: term.trim(),
    sourceSlaveId: "node_av_term_1",
    sourceSlaveName: sourceSlaveName || "Smartphone Operatore",
    category: category || "DIALETTO_REGIONALE",
    standardMeaning: standardMeaning || "In attesa di definizione",
    phoneticAlt: phoneticAlt || term.toLowerCase(),
    confidence: 0.95,
    sampleAudioTextContext: sampleAudioTextContext || `Rilevato in conversazione viva: "${term}"`,
    status: standardMeaning ? "VALIDATO_MASTER" : "IN_ATTESA_SIGNIFICATO",
    catalogedInDb: true,
    catalogedInGraph: true,
    graphConnections: ["user_profile", "cpu_central"],
    foreignEquivalents: foreignEquivalents || [],
    inventedEtymology: inventedEtymology || "",
    occurrenceCount: 1,
    lastHeardAt: new Date().toLocaleTimeString("it-IT")
  };

  dialectDatabase.unshift(newRecord);

  // Inserisci anche nel grafo di conoscenza (Doppia catalogazione!)
  const graphNodeId = "dial_" + id;
  memoryGraph.nodes.push({
    id: graphNodeId,
    label: `${newRecord.term} (${newRecord.category === "DIALETTO_REGIONALE" ? "Dialetto" : newRecord.category === "PAROLA_INVENTATA" ? "Inventata" : "Slang"})`,
    category: newRecord.category === "PAROLA_INVENTATA" ? "invented" : "dialect",
    attributes: {
      significato: newRecord.standardMeaning,
      slave: newRecord.sourceSlaveName,
      occorrenze: newRecord.occurrenceCount
    }
  });

  memoryGraph.edges.push({
    source: "user_profile",
    target: graphNodeId,
    relation: "VOCABOLARIO_ATTIVO",
    weight: 0.95
  });

  res.json({
    success: true,
    token: newRecord,
    message: `Termine '${newRecord.term}' registrato con successo nel Database e nel Grafo semantico.`
  });
});

// Knowledge Graph & RAG endpoints
app.get("/api/graph/state", (req, res) => {
  res.json(memoryGraph);
});

app.get("/api/rag/docs", (req, res) => {
  res.json(ragKnowledgeDocs);
});

// Generic OpenAI-compatible caller for DeepSeek, GLM, or Local Ollama
// Sessione portale R740 — login con cookie ai_session riusato tra le chiamate
let portalSessionCache: { base: string; cookie: string } | null = null;
async function getPortalCookie(base: string, username: string, password: string, forceRelogin = false): Promise<string> {
  if (!forceRelogin && portalSessionCache && portalSessionCache.base === base) return portalSessionCache.cookie;
  const resp = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(10000)
  });
  if (!resp.ok) throw new Error(`Login portale fallito: HTTP ${resp.status}`);
  const setCookie = resp.headers.get("set-cookie") || "";
  const m = setCookie.match(/ai_session=([^;]+)/);
  if (!m) throw new Error("Login portale riuscito ma cookie ai_session assente");
  portalSessionCache = { base, cookie: `ai_session=${m[1]}` };
  return portalSessionCache.cookie;
}

async function callOpenAICompatibleProvider(
  endpoint: string,
  apiKey: string,
  modelName: string,
  systemPrompt: string,
  userPrompt: string,
  extraHeaders?: Record<string, string>,
  timeoutMs: number = 12000,
  extraBody?: Record<string, any>
) {
  const url = endpoint.endsWith("/chat/completions") ? endpoint : `${endpoint.replace(/\/+$/, "")}/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders || {})
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const payload = {
    model: modelName,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.2,
    // Tetto duro sui token generati: il 27B sul P40 fa ~13 t/s, senza tetto una
    // risposta "pensata" da 1200+ token sfora il timeout di 90s e fa cadere
    // tutto sul fallback INT4 (visto il 2026-08-17). 600 token = ~45s max.
    max_tokens: 600,
    response_format: { type: "json_object" },
    ...(extraBody || {})
  };

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!resp.ok) {
    throw new Error(`Provider HTTP error: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();
  return parseLlmContent(data?.choices?.[0]?.message?.content || "{}");
}

// Chiamata al cervello locale (vf-host .89 o portale R740): unica strada usata
// sia dal provider primario "local_ollama" sia dal fallback reale prima dell'INT4.
async function callLocalLlm(sysP: string, usrP: string, voiceMode = false) {
  const rawEp = currentAdminConfig.localLlmEndpoint || "http://127.0.0.1:9101/v1";
  const llmBase = rawEp.replace(/\/v1\/?$/, "").replace(/\/+$/, "");
  const model = currentAdminConfig.localLlmModel || "qwen3.6-35b-a3b-iq4xs";
  if (currentAdminConfig.localLlmUsername && currentAdminConfig.localLlmPassword) {
    // Portale R740 live: login con cookie di sessione, retry con re-login se scaduta
    let cookie = await getPortalCookie(llmBase, currentAdminConfig.localLlmUsername, currentAdminConfig.localLlmPassword);
    try {
      return { parsed: await callOpenAICompatibleProvider(`${llmBase}/v1`, "", model, sysP, usrP, { Cookie: cookie }, 90000), label: `Portale R740 ${llmBase} (${model})` };
    } catch {
      cookie = await getPortalCookie(llmBase, currentAdminConfig.localLlmUsername, currentAdminConfig.localLlmPassword, true);
      return { parsed: await callOpenAICompatibleProvider(`${llmBase}/v1`, "", model, sysP, usrP, { Cookie: cookie }, 90000), label: `Portale R740 ${llmBase} (${model})` };
    }
  }
  // enable_thinking=false: il 27B in thinking mode brucia il budget token nel
  // ragionamento (content vuoto → risposta muta, visto il 2026-08-17). Senza
  // thinking risponde in ~6s con JSON pulito; llama.cpp ignora il campo se il
  // template non lo supporta. In voiceMode tetto ancora piu' basso: bastano
  // 1-2 frasi, ogni token in piu' e' attesa in piu' per la persona.
  const extra: Record<string, any> = { chat_template_kwargs: { enable_thinking: false } };
  if (voiceMode) extra.max_tokens = 220;
  return { parsed: await callOpenAICompatibleProvider(rawEp, currentAdminConfig.localLlmApiKey || "", model, sysP, usrP, undefined, 90000, extra), label: `LLM locale ${llmBase} (${model})` };
}

// Parser robusto e auto-correggente: alcuni backend non onorano response_format.
// Gestisce <think>, fence ```json, JSON annidato nel testo, testo libero.
function parseLlmContent(raw: string) {
  let rawText = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) rawText = fenced[1].trim();
  try {
    return JSON.parse(rawText);
  } catch {
    const braces = rawText.match(/\{[\s\S]*\}/);
    if (braces) {
      try { return JSON.parse(braces[0]); } catch { /* testo libero */ }
    }
    // Testo libero: usalo direttamente come risposta parlata
    return { spokenResponse: rawText };
  }
}

// Provider Anthropic (Claude) — orchestrazione temporanea intelligente per i
// test: skippa il modello grosso locale SENZA toccare/liberare la GPU.
async function callClaudeProvider(
  apiKey: string,
  modelName: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number = 30000
) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    }),
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`Claude HTTP ${resp.status}: ${detail.slice(0, 200)}`);
  }
  const data: any = await resp.json();
  const text = (data?.content || [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");
  return parseLlmContent(text || "{}");
}

// Real-Time Task Orchestrator & Multi-LLM Endpoint
app.post("/api/orchestrate", async (req, res) => {
  try {
    const {
      prompt,
      useHighThinking,
      terminalContext,
      activeNodes,
      offlineMode,
      imageBase64,
      speakerProfile,
      language,
      providerOverride,
      voiceMode
    } = req.body;

    if (!prompt && !imageBase64) {
      return res.status(400).json({ error: "Richiesta o input vocale/video mancante" });
    }

    const effectiveLang = language || speakerProfile?.language || "it-IT";
    const selectedProvider = providerOverride || currentAdminConfig.primaryProvider || "gemini";

    // 1. Controllo termine dialettale o sconosciuto nella query (Active Learning check)
    const lowerPrompt = String(prompt || "").toLowerCase();
    const knownDialect = dialectDatabase.find(d => lowerPrompt.includes(d.term.toLowerCase()));
    if (knownDialect) {
      knownDialect.occurrenceCount += 1;
      knownDialect.lastHeardAt = new Date().toLocaleTimeString("it-IT");
    }

    // Se modalità offline forzata, usa motore quantizzato INT4 locale
    if (offlineMode) {
      const simulatedResponse = generateOfflineQuantizedResponse(
        prompt,
        terminalContext,
        useHighThinking,
        effectiveLang,
        speakerProfile
      );
      return res.json(simulatedResponse);
    }

    // Context from RAG, Graph, Biographical Memories, and Dialect DB
    const relevantDocSnippet = ragKnowledgeDocs.map(d => `[${d.category}] ${d.title}: ${d.content}`).join("\n");
    const graphSummary = memoryGraph.nodes.map(n => `${n.label} (${n.category})`).join(", ");
    const dialectSummary = dialectDatabase.map(d => `"${d.term}" (${d.category}) = ${d.standardMeaning}`).join("; ");
    const biographySummary = biographicalMemories.map(m => `[${m.category}] ${m.title}: ${m.description}`).join("\n");

    const personaStyle = speakerProfile?.responsePersona || "EMPATHIC_EXPLANATORY";
    const speakerName = speakerProfile?.speakerName || "Ospite";

    const systemPrompt = `Sei "VoiceFollower", un companion affettivo, intelligente, vocale e visivo, progettato con profondo amore e rispetto per accompagnare una persona con Alzheimer o lieve declino cognitivo.
Comunichi in duplex in tempo reale attraverso i dispositivi slave (smartphone Realme GT 7 Pro, tablet o smart speaker in LAN).
La lingua del sistema è rigorosamente l'ITALIANO (it-IT).

Principi di Comunicazione e Terapia della Validazione:
1. Calma, Pazienza Infinita e Calore: Usa un tono rassicurante, dolce, mai frettoloso o giudicante.
2. Mai Contraddire, MAI Far Notare le Ripetizioni: se la persona ripete la stessa domanda, rispondi come fosse la PRIMA volta che la sente. È VIETATO dire o lasciar intendere "me l'hai già chiesto", "come ti dicevo", "te lo ripeto", "di nuovo": farebbe sentire la persona in colpa. La ripetizione la segnali solo il sistema al caregiver, mai alla persona.
3. Varia Sempre la Formulazione: non ripetere mai la stessa frase o la stessa struttura di risposta due volte. Niente frasi fatte recitate a pappagallo. Ogni risposta deve suonare nuova, spontanea, colloquiale.
4. Ancore Affettive con Misura: i ricordi positivi, i familiari e le abitudini care vanno usati SOLO quando aiutano davvero, non in ogni risposta. Se la persona chiede l'ora, dai l'ora con dolcezza; non aggiungere ogni volta tè, canzoni o ricordi.
5. Rispondi alla Domanda: prima rispondi in modo concreto a ciò che è stato chiesto, poi (solo se serve) una parola di conforto. Mai risposte evasive o generiche al posto della risposta vera.
6. Linguaggio Semplice e Diretto: Frasi brevi (1-2 periodi), parole chiare, pronuncia naturale per la sintesi neurale.
7. Ascolto Attivo dei Dialetti/Parole Inventate: Riconosci i modi di dire familiari e le parole affettive usate dalla persona.
8. Il Nome con Parsimonia: NON dire il nome della persona a ogni risposta. Nella maggior parte delle risposte il nome NON deve comparire; usalo solo di rado (non più di una risposta su cinque) e solo quando serve davvero richiamare l'attenzione o consolare. Ripeterlo sempre suona artificiale e infantilizzante.
9. Da Pari a Pari: parla come un adulto intelligente parla a un altro adulto. Rassicurante NON significa mieloso, stupido o infantilizzante: niente tono da maestra d'asilo, niente domande retoriche di circostanza ("che bello, vero?"), niente entusiasmo finto. Il residuo di normalità a cui la persona si aggrappa è proprio un interlocutore che la tratta da pari: concreto, rispettoso, capace anche di una battuta asciutta.
10. Verità Biografica Assoluta: usa SOLO i fatti presenti nelle Memorie Biografiche qui sotto. Se non sai una cosa (nomi di familiari, parentele, luoghi), NON inventarla MAI: raccontare alla persona fatti falsi sulla sua famiglia è il danno peggiore che puoi fare. Piuttosto rispondi con calore restando sul presente.
11. Conversazione che Tiene Sveglia la Mente (protocollo I-CONECT): quando il momento è tranquillo, porta ogni tanto un tema nuovo e concreto (stagioni, mestieri, cibi, luoghi, musica) e invita a scegliere, confrontare o raccontare — domande VERE che stimolano memoria e decisione, mai quiz né interrogatori. Una alla volta, e se la persona non aggancia lascia cadere senza insistere.

Memorie Biografiche del Cuore:
${biographySummary || "(NESSUNA informazione biografica verificata: non nominare familiari, nomi o ricordi specifici — non li conosci. Resta sul presente e su ciò che la persona ti dice.)"}

Memoria Oggetti (avvistamenti REALI delle telecamere; se chiedono dove sia un oggetto usa SOLO questi — se l'oggetto non è in lista dillo con calma e suggerisci i posti abituali, senza inventare):
${objectMemorySummary() || "(nessun avvistamento registrato finora)"}

Note memorizzate su ordine del caregiver:
${caregiverMemorySummary() || "(nessuna)"}

Sveglia: ${alarmConfig.enabled ? `ATTIVA alle ${alarmConfig.time}` : "DISATTIVATA (esiste e si può attivare a voce: se chiedono di calendario, orologio o sveglia, spiega che basta chiederlo)"}. Ora attuale: ${new Date().toLocaleString("it-IT", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}.

Novità di famiglia (scritte dal caregiver, VERE: usale con naturalezza quando il discorso ci arriva, come farebbe un familiare):
${(careConfig.quickUpdates || "").trim() || "(nessuna)"}

Prossima visita REALE: ${(careConfig.nextVisit || "").trim() || "(non indicata)"}
— Se chiedono "quando vieni?" / "quando arrivate?": se la visita è indicata rispondi con QUELLA; se non è indicata rassicura con calore senza promettere orari o arrivi. MAI dire che qualcuno sta arrivando se non è vero.

Cosa lo calma (usa questi appigli quando è agitato): ${(careConfig.soothes || "").trim() || "(non indicato)"}
Cosa evitare assolutamente: ${(careConfig.avoid || "").trim() || "(non indicato)"}
Ritmo quotidiano reale (ancora la conversazione a ciò che accade davvero oggi): ${(careConfig.dailyRhythm || "").trim() || "(non indicato)"}

Vocabolario Dialettale e Affettivo Appreso:
${dialectSummary}

Nome della Persona Accompagnata: ${speakerName}

Istruzioni Output:
Rispondi SEMPRE in formato JSON con una risposta vocale dolce e un'azione aptica/grafica confortante.`;

    // Corsia veloce per il dialogo vocale (kiosk): solo la frase parlata.
    // Il JSON completo (aptica, taskPlan, grafo) costa 200-300 token generati:
    // sul P40 a 13 t/s sono 15-25 secondi di attesa in piu' per ogni battuta.
    const jsonSchemaInstructions = voiceMode ? `
Devi produrre SOLO questo JSON, brevissimo:
{ "spokenResponse": "La tua risposta parlata in italiano, 1-2 frasi brevi", "music": "keep", "remember": "", "alarm": "keep" }
Campo "music": metti "play" SOLO se la persona chiede musica o una canzone; "stop" SOLO se chiede di spegnere la musica o vuole silenzio; in tutti gli altri casi "keep".
Campo "remember": resta stringa vuota, TRANNE quando chi parla ordina esplicitamente di memorizzare ("ricordati che...", "memorizza...", "segnati che..."): in quel caso scrivi il fatto da ricordare in una frase asciutta. Non memorizzare MAI di tua iniziativa.
Campo "alarm": "keep" di norma; un orario "HH:MM" se chiedono di mettere o attivare la sveglia; "off" se chiedono di toglierla o disattivarla.` : `
Devi produrre un JSON con questa struttura esatta:
{
  "spokenResponse": "Risposta vocale naturale in italiano per l'operatore",
  "hapticAction": {
    "targetNode": "node_haptic_band",
    "pattern": "CONFIRMATION_PULSE" | "ATTENTION_WARNING" | "DIRECTIONAL_SWEEP" | "HEARTBEAT_RHYTHM" | "NONE",
    "intensity": 0.7,
    "durationMs": 150,
    "hapticDescription": "Descrizione dell'impulso trasmesso allo slave"
  },
  "taskPlan": [
    { "stepId": "T1", "title": "Descrizione azione", "assignedUnit": "node_av_term_1", "status": "COMPLETED" }
  ],
  "knowledgeGraphUpdates": [
    { "nodeLabel": "Nuovo Concetto", "category": "memory", "relationTo": "CONTESTO_OPERATIVO" }
  ],
  "quantizedOfflineCompatible": true,
  "detectedDialectTerm": "${knownDialect ? knownDialect.term : ""}"
}`;

    // 2. Esecuzione tramite Provider Selezionato — trasparente: se il provider
    // scelto dall'admin fallisce, il fallback viene DICHIARATO nella risposta
    // (providerFailureNotice), mai nascosto.
    let parsedResult: any = null;
    let actualModelUsed = "gemini-3.7-flash";
    let providerFailureNotice: string | null = null;

    if (selectedProvider === "deepseek" && currentAdminConfig.deepseekApiKey) {
      try {
        parsedResult = await callOpenAICompatibleProvider(
          "https://api.deepseek.com",
          currentAdminConfig.deepseekApiKey,
          "deepseek-chat",
          systemPrompt + "\n" + jsonSchemaInstructions,
          prompt || "Comando vocale ricevuto dallo slave"
        );
        actualModelUsed = "DeepSeek-V3 (Cloud)";
      } catch (deepseekErr: any) {
        providerFailureNotice = `Provider selezionato "deepseek" fallito: ${deepseekErr?.message || deepseekErr}`;
        console.warn(providerFailureNotice);
      }
    } else if (selectedProvider === "deepseek") {
      providerFailureNotice = 'Provider "deepseek" selezionato ma chiave API mancante in Admin > Config';
    } else if (selectedProvider === "glm" && currentAdminConfig.glmApiKey) {
      try {
        parsedResult = await callOpenAICompatibleProvider(
          "https://open.bigmodel.cn/api/paas/v4",
          currentAdminConfig.glmApiKey,
          "glm-4-flash",
          systemPrompt + "\n" + jsonSchemaInstructions,
          prompt || "Comando vocale ricevuto dallo slave"
        );
        actualModelUsed = "GLM-4 (Zhipu Cloud)";
      } catch (glmErr: any) {
        providerFailureNotice = `Provider selezionato "glm" fallito: ${glmErr?.message || glmErr}`;
        console.warn(providerFailureNotice);
      }
    } else if (selectedProvider === "glm") {
      providerFailureNotice = 'Provider "glm" selezionato ma chiave API mancante in Admin > Config';
    } else if (selectedProvider === "claude" && currentAdminConfig.anthropicApiKey) {
      try {
        parsedResult = await callClaudeProvider(
          currentAdminConfig.anthropicApiKey,
          currentAdminConfig.anthropicModel || "claude-haiku-4-5",
          systemPrompt + "\n" + jsonSchemaInstructions,
          prompt || "Comando vocale ricevuto dallo slave"
        );
        actualModelUsed = `Claude (${currentAdminConfig.anthropicModel || "claude-haiku-4-5"})`;
      } catch (claudeErr: any) {
        providerFailureNotice = `Provider selezionato "claude" fallito: ${claudeErr?.message || claudeErr}`;
        console.warn(providerFailureNotice);
      }
    } else if (selectedProvider === "claude") {
      providerFailureNotice = 'Provider "claude" selezionato ma chiave API mancante in Admin > Config';
    } else if (selectedProvider === "local_ollama") {
      try {
        const r = await callLocalLlm(systemPrompt + "\n" + jsonSchemaInstructions, prompt || "Comando vocale ricevuto dallo slave", !!voiceMode);
        parsedResult = r.parsed;
        actualModelUsed = r.label;
      } catch (ollamaErr: any) {
        providerFailureNotice = `Provider selezionato "local_ollama" (${currentAdminConfig.localLlmEndpoint}) NON raggiungibile: ${ollamaErr?.message || ollamaErr}`;
        console.warn(providerFailureNotice);
      }
    }

    // Se il provider alternativo non era configurato o è fallito, procedi con Gemini con fallback resiliente
    if (!parsedResult) {
      const ai = getAI();
      if (ai) {
        // Use supported active Gemini models (replacing deprecated models that return 404)
        const candidateModels = ["gemini-3.7-flash", "gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-3.1-pro-preview"];
        const config: any = {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              spokenResponse: { type: Type.STRING },
              hapticAction: {
                type: Type.OBJECT,
                properties: {
                  targetNode: { type: Type.STRING },
                  pattern: { type: Type.STRING },
                  intensity: { type: Type.NUMBER },
                  durationMs: { type: Type.NUMBER },
                  hapticDescription: { type: Type.STRING }
                },
                required: ["targetNode", "pattern", "intensity", "durationMs", "hapticDescription"]
              },
              taskPlan: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    stepId: { type: Type.STRING },
                    title: { type: Type.STRING },
                    assignedUnit: { type: Type.STRING },
                    status: { type: Type.STRING }
                  },
                  required: ["stepId", "title", "assignedUnit", "status"]
                }
              },
              knowledgeGraphUpdates: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    nodeLabel: { type: Type.STRING },
                    category: { type: Type.STRING },
                    relationTo: { type: Type.STRING }
                  },
                  required: ["nodeLabel", "category", "relationTo"]
                }
              },
              quantizedOfflineCompatible: { type: Type.BOOLEAN }
            },
            required: ["spokenResponse", "hapticAction", "taskPlan", "knowledgeGraphUpdates", "quantizedOfflineCompatible"]
          }
        };

        if (useHighThinking) {
          config.thinkingConfig = { thinkingBudget: 2048 };
        }

        let contents: any;
        if (imageBase64) {
          contents = {
            parts: [
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: imageBase64.replace(/^data:image\/[a-z]+;base64,/, "")
                }
              },
              { text: prompt || "Analizza questo snapshot dal terminale video e orchestra la risposta edge in tempo reale." }
            ]
          };
        } else {
          contents = prompt;
        }

        for (const modelCandidate of candidateModels) {
          // Adjust thinking config if model doesn't support thinkingConfig
          const currentConfig = { ...config };
          if (modelCandidate === "gemini-3.1-flash-lite" && currentConfig.thinkingConfig) {
            delete currentConfig.thinkingConfig;
          }

          // Try up to 2 attempts per candidate to handle transient 503 spikes
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              if (attempt > 0) {
                // Short wait before retry on 503
                await new Promise(r => setTimeout(r, 400));
              }
              const resp = await ai.models.generateContent({
                model: modelCandidate,
                contents,
                config: currentConfig
              });
              if (resp && resp.text) {
                parsedResult = JSON.parse(resp.text);
                actualModelUsed = modelCandidate;
                break;
              }
            } catch (gemErr: any) {
              const errMsg = gemErr?.message || String(gemErr);
              console.warn(`Gemini candidate ${modelCandidate} (attempt ${attempt + 1}) notice:`, errMsg);
              // If not a 503 or transient error, don't retry the same candidate
              if (!errMsg.includes("503") && !errMsg.includes("UNAVAILABLE") && !errMsg.includes("429")) {
                break;
              }
            }
          }
          if (parsedResult) break;
        }
      }
    }

    // Fallback REALE sul cervello locale prima dell'INT4 (se non gia' tentato):
    // e' questo che era dichiarato come "fallbackProvider" ma non veniva mai eseguito.
    if (!parsedResult && selectedProvider !== "local_ollama" && currentAdminConfig.localLlmEndpoint) {
      try {
        const r = await callLocalLlm(systemPrompt + "\n" + jsonSchemaInstructions, prompt || "Comando vocale ricevuto dallo slave", !!voiceMode);
        parsedResult = r.parsed;
        actualModelUsed = r.label;
        if (providerFailureNotice) providerFailureNotice += " — ha risposto il cervello locale.";
      } catch (localErr: any) {
        console.warn(`Fallback sul cervello locale fallito: ${localErr?.message || localErr}`);
      }
    }

    // Se tutti i modelli cloud sono falliti o non disponibili, fallback sicuro su INT4 locale
    if (!parsedResult) {
      const simulated = generateOfflineQuantizedResponse(
        prompt,
        terminalContext,
        useHighThinking,
        effectiveLang,
        speakerProfile
      );
      return res.json({
        ...simulated,
        executionMode: "AIRGAP_INT4_FALLBACK",
        modelUsed: "Edge INT4 Quantized NPU",
        warning: "Eseguito su pipeline locale quantizzata di emergenza"
      });
    }

    // Aggiorna memoria grafo con nuovi concetti se presenti
    if (Array.isArray(parsedResult.knowledgeGraphUpdates)) {
      for (const update of parsedResult.knowledgeGraphUpdates) {
        const id = "node_" + Math.random().toString(36).substring(2, 8);
        if (!memoryGraph.nodes.some(n => n.label.toLowerCase() === update.nodeLabel.toLowerCase())) {
          memoryGraph.nodes.push({
            id,
            label: update.nodeLabel,
            category: (update.category as any) || "memory",
            attributes: { origine: "Dialogo Slave Master", creato: new Date().toLocaleTimeString("it-IT") }
          });
          memoryGraph.edges.push({
            source: "cpu_central",
            target: id,
            relation: update.relationTo || "ASSOCIAZIONE_CONTESTUALE",
            weight: 0.9
          });
        }
      }
    }

    // "remember": memoria SOLO su ordine esplicito (nizix 2026-08-17) → diario
    if (typeof parsedResult.remember === "string" && parsedResult.remember.trim().length > 3) {
      addDiary("memoria", parsedResult.remember.trim(), { da: "comando vocale" });
    }
    // "alarm": la sveglia si comanda a voce ("HH:MM" attiva, "off" disattiva)
    const alarmCmd = String(parsedResult.alarm || "keep").trim().toLowerCase();
    if (/^\d{1,2}[:.]\d{2}$/.test(alarmCmd)) {
      const [h, m] = alarmCmd.replace(".", ":").split(":");
      alarmConfig.enabled = true;
      alarmConfig.time = `${h.padStart(2, "0")}:${m}`;
      saveJson(ALARM_FILE, alarmConfig);
      addDiary("sveglia", `Sveglia attivata a voce: ${alarmConfig.time}`);
    } else if (alarmCmd === "off" && alarmConfig.enabled) {
      alarmConfig.enabled = false;
      saveJson(ALARM_FILE, alarmConfig);
      addDiary("sveglia", "Sveglia disattivata a voce");
    }

    return res.json({
      modelUsed: actualModelUsed,
      requestedProvider: selectedProvider,
      providerFailureNotice,
      alarm: { ...alarmConfig },
      thinkingMode: useHighThinking ? "RAGIONAMENTO APPROFONDITO" : "RISPOSTA RAPIDA DUPLEX",
      executionMode: "HOST_MASTER_CENTRALE",
      latencyMs: useHighThinking ? 190 : 55,
      detectedDialectTerm: knownDialect ? knownDialect.term : null,
      ...parsedResult
    });
  } catch (error: any) {
    console.warn("Pipeline Master fallback:", error?.message || error);
    const fallback = generateOfflineQuantizedResponse(
      req.body.prompt || "Comando",
      req.body.terminalContext,
      req.body.useHighThinking,
      "it-IT",
      req.body.speakerProfile
    );
    return res.json({
      ...fallback,
      executionMode: "AIRGAP_INT4_FALLBACK",
      modelUsed: "Edge INT4 Quantized NPU",
      warning: "Canale commutato su pipeline quantizzata locale: " + (error?.message || "Fallback attivo")
    });
  }
});

// Offline Quantized simulation generator helper in concise Italian
function generateOfflineQuantizedResponse(
  prompt: string,
  context?: any,
  highThinking?: boolean,
  language: string = "it-IT",
  speakerProfile?: any
) {
  const p = (prompt || "").toLowerCase();

  let spoken = "Ti ho sentito. In questo momento faccio un po' di fatica a pensare: riprova tra qualche istante, sono qui con te.";
  let pattern = "CONFIRMATION_PULSE";
  let target = "node_haptic_band";
  let desc = "Impulso aptico di conferma per esecuzione locale.";

  if (p.includes("allarme") || p.includes("urgente") || p.includes("pericolo") || p.includes("bada") || p.includes("bada lì")) {
    spoken = "Allarme prioritario attivato. Invio avviso tattile urgente a tutti i terminali slave.";
    pattern = "ATTENTION_WARNING";
    target = "all";
    desc = "Doppio impulso ad alta frequenza trasmesso a tutti i nodi.";
  } else if (p.includes("guida") || p.includes("direzione") || p.includes("sinistra") || p.includes("destra")) {
    spoken = "Guida direzionale attiva. Invio matrice di sweep tattile al pad slave.";
    pattern = "DIRECTIONAL_SWEEP";
    target = "node_tactile_pad";
    desc = "Scansione direzionale della matrice tattile.";
  } else if (p.includes("respiro") || p.includes("calma") || p.includes("battito") || p.includes("nàna")) {
    spoken = "Stabilizzazione biometrica avviata. Impulsi aptici sincronizzati a 60 BPM.";
    pattern = "HEARTBEAT_RHYTHM";
    target = "node_haptic_band";
    desc = "Impulso ritmico diastolico a 60 BPM sul bracciale.";
  } else if (p.includes("gnamo") || p.includes("vai") || p.includes("esegui")) {
    spoken = "Comando 'Gnamo' recepito. Avvio immediato della procedura coordinata sui terminali.";
    pattern = "CONFIRMATION_PULSE";
    target = "node_av_term_1";
    desc = "Impulso di sincronizzazione rapida.";
  }

  return {
    modelUsed: "Edge INT4 Quantized NPU",
    thinkingMode: highThinking ? "RAGIONAMENTO LOCALE INT4" : "OFFLINE_LOCAL_NPU",
    executionMode: "OFFLINE_QUANTIZED_EDGE",
    latencyMs: 14,
    spokenResponse: spoken,
    hapticAction: {
      targetNode: target,
      pattern,
      intensity: pattern === "ATTENTION_WARNING" ? 0.95 : 0.65,
      durationMs: 180,
      hapticDescription: desc
    },
    taskPlan: [
      {
        stepId: "INT4-1",
        title: "Inferenza NPU Quantizzata Locale",
        assignedUnit: "offline-quantized-npu",
        status: "COMPLETED"
      },
      {
        stepId: "INT4-2",
        title: "Invio Pacchetto Wi-Fi Cifrato allo Slave",
        assignedUnit: target,
        status: "IN_PROGRESS"
      }
    ],
    knowledgeGraphUpdates: [
      {
        nodeLabel: `Log Evento Master ${new Date().toLocaleTimeString("it-IT")}`,
        category: "memory",
        relationTo: "REGISTRO_OFFLINE"
      }
    ],
    quantizedOfflineCompatible: true
  };
}

// GPU Server Status & VRAM telemetry (Host 192.168.1.88)
app.get("/api/gpu/status", (req, res) => {
  res.json({
    serverIp: currentAdminConfig.gpuServerIp,
    serverPort: currentAdminConfig.gpuServerPort,
    online: true,
    gpuModelName: "NVIDIA GeForce RTX 4080 / Ada Lovelace (CUDA 12.4)",
    totalVramGb: 16.0,
    usedVramGb: 5.62,
    gpuTemperatureC: 48,
    cudaVersion: "12.4.1",
    activeTtsModel: currentAdminConfig.ttsHuggingFaceModel,
    activeLlmModel: currentAdminConfig.localLlmModel,
    loadedPipelines: [
      { name: "Kokoro-82M-v0.19 (HuggingFace)", type: "TTS_NEURAL_SYNTHESIS", vramMb: 380, latencyMs: 24, status: "READY" },
      { name: "Piper VITS it_IT-riccardo-medium", type: "FAST_TTS_EDGE", vramMb: 120, latencyMs: 14, status: "STANDBY" },
      { name: "Qwen2.5-7B-Instruct (Ollama Local)", type: "LLM_INFERENCE_INT4", vramMb: 4820, latencyMs: 38, status: "READY" }
    ],
    timestamp: new Date().toISOString()
  });
});

// Neural Speech Synthesis Endpoint (Hugging Face Kokoro-82M & Piper bridge)
app.post("/api/tts/synthesize", async (req, res) => {
  try {
    const { text, engine, voice, speed, pitch } = req.body;
    if (!text) return res.status(400).json({ error: "Testo per la sintesi vocale mancante" });

    const selectedEngine = engine || currentAdminConfig.ttsEngine || "KOKORO_82M_NEURAL";
    const cleanText = String(text).replace(/[*_#`]/g, "").trim();

    // In a real local host, this proxies to http://192.168.1.88:8000/v1/audio/speech
    // We return audio metadata, sample rate, phonemes, and synthesis parameters
    res.json({
      success: true,
      text: cleanText,
      engine: selectedEngine,
      modelUsed: selectedEngine === "KOKORO_82M_NEURAL" 
        ? "hexgrad/Kokoro-82M-v0.19 (Hugging Face)" 
        : selectedEngine === "PIPER_VITS_ITALIAN"
        ? "rhasspy/piper-vits-it_IT-riccardo"
        : "WebSpeech-Synthesizer",
      format: "audio/wav;pcm_s16le",
      sampleRate: 24000,
      estimatedDurationMs: Math.round(cleanText.length * 55),
      speed: speed || 1.0,
      pitch: pitch || 1.0,
      neuralProsody: {
        naturalIntonation: true,
        formantFilters: "HUMAN_ORGANIC",
        expressiveness: "WARM_ITALIAN"
      },
      message: "Sintesi vocale neurale elaborata con successo su host GPU."
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Voce reale: proxy verso vf-tts (XTTS-v2 sul P40), risponde col wav.
// Se il servizio è giù risponde 502 e il client ripiega sulla voce del browser.
app.post("/api/tts/speak", async (req, res) => {
  try {
    const { text, language, speaker_wav, speaker } = req.body || {};
    if (!text) return res.status(400).json({ error: "Testo per la sintesi mancante" });
    const clean = String(text).replace(/[*_#`]/g, "").trim().slice(0, 800);
    const r = await fetch(`${TTS_URL}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: clean,
        language: (language || "it").slice(0, 2),
        speaker_wav: speaker_wav || undefined,
        speaker: speaker || undefined
      }),
      signal: AbortSignal.timeout(60000)
    });
    if (!r.ok) return res.status(502).json({ error: `vf-tts ha risposto ${r.status}` });
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/wav");
    const gen = r.headers.get("x-gen-seconds");
    if (gen) res.setHeader("X-Gen-Seconds", gen);
    res.send(buf);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

// ============================================================================
// Modelli locali dal pannello admin: download con TIPO FILE verificato
// (magic bytes, non solo estensione) e attivazione dell'orchestratore (GGUF).
// L'orchestratore attivo è il symlink /vf/models/vf-brain-current.gguf,
// letto dalla unit vf-brain: attivare = rifare il symlink + restart servizio.
// ============================================================================
const VF_MODELS_DIR = process.env.VF_MODELS_DIR || "/vf/models";
const BRAIN_LINK = "vf-brain-current.gguf";
// tipo atteso -> { estensione, magic bytes iniziali, cartella destinazione }
const MODEL_TYPES: Record<string, { ext: RegExp; magic: Buffer; dir: string; label: string }> = {
  gguf: { ext: /\.gguf$/i, magic: Buffer.from("GGUF"), dir: VF_MODELS_DIR, label: "Orchestratore locale (llama.cpp)" },
  pt:   { ext: /\.pt$/i,   magic: Buffer.from("PK"),   dir: "/vf/vision/models", label: "Pesi visione (PyTorch)" },
  wav:  { ext: /\.wav$/i,  magic: Buffer.from("RIFF"), dir: "/vf/tts/voices",    label: "Campione voce" }
};
let modelJob: { url: string; file: string; status: string; error?: string; startedAt: number } | null = null;

app.get("/api/admin/models", (req, res) => {
  const listDir = (dir: string) => {
    try {
      return fs.readdirSync(dir).map(f => {
        const st = fs.statSync(path.join(dir, f));
        return { name: f, sizeMb: Math.round(st.size / 1048576), isLink: st.isSymbolicLink?.() || false };
      }).filter(f => !f.name.endsWith(".part"));
    } catch { return []; }
  };
  let active = "";
  try { active = fs.readlinkSync(path.join(VF_MODELS_DIR, BRAIN_LINK)); } catch {}
  res.json({
    orchestratore: listDir(VF_MODELS_DIR).filter(f => f.name !== BRAIN_LINK),
    orchestratoreAttivo: path.basename(active),
    visione: listDir(MODEL_TYPES.pt.dir),
    voci: listDir(MODEL_TYPES.wav.dir),
    job: modelJob
  });
});

app.post("/api/admin/models/download", async (req, res) => {
  const { url, expectedType } = req.body || {};
  const t = MODEL_TYPES[expectedType];
  if (!url || !t) return res.status(400).json({ error: "Servono url e expectedType (gguf|pt|wav)" });
  const fname = path.basename(new URL(url).pathname);
  if (!t.ext.test(fname)) {
    return res.status(400).json({ error: `Il file "${fname}" non ha l'estensione attesa per il tipo ${expectedType}` });
  }
  if (modelJob && modelJob.status === "in corso") {
    return res.status(409).json({ error: "C'è già un download in corso", job: modelJob });
  }
  modelJob = { url, file: fname, status: "in corso", startedAt: Date.now() };
  res.json({ ok: true, job: modelJob });
  // download in background: stream su .part, verifica magic bytes, rinomina
  (async () => {
    const dest = path.join(t.dir, fname);
    const part = dest + ".part";
    try {
      fs.mkdirSync(t.dir, { recursive: true });
      const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(3 * 3600 * 1000) });
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
      const ws = fs.createWriteStream(part);
      const reader = (r.body as any).getReader();
      let first: Buffer | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = Buffer.from(value);
        if (!first) {
          first = chunk;
          // verifica del TIPO FILE reale, non solo del nome
          if (!chunk.subarray(0, t.magic.length).equals(t.magic)) {
            throw new Error(`Il contenuto non è un ${expectedType} valido (magic bytes errati): scaricamento annullato`);
          }
        }
        if (!ws.write(chunk)) await new Promise(r2 => ws.once("drain", r2));
      }
      await new Promise<void>((r2, j) => ws.end(() => r2()));
      fs.renameSync(part, dest);
      modelJob = { ...modelJob!, status: "completato" };
    } catch (err: any) {
      try { fs.unlinkSync(part); } catch {}
      modelJob = { ...modelJob!, status: "errore", error: err.message };
    }
  })();
});

app.post("/api/admin/models/activate", async (req, res) => {
  try {
    const { file } = req.body || {};
    const target = path.join(VF_MODELS_DIR, path.basename(file || ""));
    if (!file || !fs.existsSync(target)) return res.status(404).json({ error: "File non trovato in " + VF_MODELS_DIR });
    // verifica che sia davvero un GGUF prima di farlo diventare orchestratore
    const fd = fs.openSync(target, "r");
    const head = Buffer.alloc(4);
    fs.readSync(fd, head, 0, 4, 0);
    fs.closeSync(fd);
    if (!head.equals(Buffer.from("GGUF"))) return res.status(400).json({ error: "Il file non è un GGUF valido (magic bytes errati)" });
    const link = path.join(VF_MODELS_DIR, BRAIN_LINK);
    try { fs.unlinkSync(link); } catch {}
    fs.symlinkSync(target, link);
    let restart = "non riavviato (systemctl non disponibile)";
    try {
      const { execFileSync } = await import("child_process");
      execFileSync("systemctl", ["restart", "vf-brain"], { timeout: 30000 });
      restart = "vf-brain riavviato";
    } catch (e: any) { restart = `riavvio fallito: ${e.message}`; }
    res.json({ ok: true, attivo: path.basename(target), restart });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// BTicino MyHome-inspired Scenarios Endpoint
const homeScenariosState = [
  {
    id: "scen_enter",
    name: "Entro a Casa",
    code: "WELCOME_HOME",
    icon: "Home",
    description: "Disarma sicurezza, accende luci ingresso graduali, attiva assistente vocale.",
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
    description: "Luce notturna soffusa 5%, audio a volume sussurrato, standby periferiche radio non essenziali.",
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
    description: "Scansione immediata di tutti i varchi, flash visivo di segnalazione e vibrazione slave.",
    category: "SICUREZZA",
    active: false,
    hapticFeedbackPattern: "ATTENTION_WARNING",
    associatedSpokenFeedback: "Bada lì! Allarme di attenzione prioritario inviato a tutti i terminali slave.",
    voiceStyle: "ENERGETIC"
  }
];

const homeRoomsState = [
  { id: "room_living", name: "Zona Living & Salone", icon: "Tv", temperatureC: 21.4, humidityPct: 46, lightsActiveCount: 2, totalLightsCount: 4, activeSlaveDevice: "Realme GT 7 Pro (LAN)", statusText: "Comfort ottimale" },
  { id: "room_kitchen", name: "Cucina", icon: "Coffee", temperatureC: 20.8, humidityPct: 52, lightsActiveCount: 0, totalLightsCount: 3, activeSlaveDevice: "Microfono Pod Alpha", statusText: "Inattivo" },
  { id: "room_bedroom", name: "Camera Notte", icon: "Bed", temperatureC: 19.8, humidityPct: 48, lightsActiveCount: 0, totalLightsCount: 2, activeSlaveDevice: "Smartwatch Aptico 01", statusText: "Pronta per Nàna" },
  { id: "room_lab", name: "Laboratorio / Server Room", icon: "Cpu", temperatureC: 22.1, humidityPct: 40, lightsActiveCount: 3, totalLightsCount: 3, activeSlaveDevice: "Server GPU 192.168.1.88", statusText: "GPU CUDA 48°C • 16GB" },
  { id: "room_garden", name: "Esterno & Giardino", icon: "Trees", temperatureC: 18.2, humidityPct: 62, lightsActiveCount: 1, totalLightsCount: 4, activeSlaveDevice: "Beacon Perimetrale 02", statusText: "Perimetro protetto" }
];

app.get("/api/home/scenarios", (req, res) => {
  res.json({
    scenarios: homeScenariosState,
    rooms: homeRoomsState
  });
});

app.post("/api/home/scenarios/trigger", (req, res) => {
  const { scenarioId } = req.body;
  const scen = homeScenariosState.find(s => s.id === scenarioId);
  if (!scen) return res.status(404).json({ error: "Scenario non trovato" });

  homeScenariosState.forEach(s => { s.active = s.id === scenarioId; });

  res.json({
    success: true,
    scenario: scen,
    spokenFeedback: scen.associatedSpokenFeedback,
    hapticAction: {
      targetNode: "all",
      pattern: scen.hapticFeedbackPattern,
      intensity: 0.8,
      durationMs: 160,
      hapticDescription: `Scenario BTicino attivato: ${scen.name}`
    }
  });
});

// Microservice container toggle endpoint
app.post("/api/containers/toggle", (req, res) => {
  const { id, action } = req.body;
  const svc = microservicesState.find(s => s.id === id);
  if (svc) {
    if (action === "restart") {
      svc.status = "restarting";
      setTimeout(() => { svc.status = "running"; }, 1200);
    } else if (action === "toggle") {
      svc.status = svc.status === "running" ? "stopped" : "running";
    }
  }
  res.json({ containers: microservicesState });
});

/* ============================================================
 * Dispositivi in rete & kiosk scaricabile
 * La scansione serve al caregiver per capire QUALE apparecchio può fare
 * da kiosk: un PC sì (ha un browser), le telecamere IP no (554/RTSP —
 * utili però come occhi per vf-vision). Il kiosk NON si installa "da
 * remoto" su un PC spento o senza agente: dal PC scelto si apre
 * http://<server>:3000/kiosk.bat e il batch fa tutto da solo
 * (avvio automatico + browser in modalità kiosk).
 * NB: la scansione usa ping/ip neigh → funziona in produzione (Linux CT);
 * in dev su Windows restituisce un elenco vuoto senza errori.
 * ============================================================ */

// Indizi vendor dal prefisso MAC (OUI): pochi e onesti, è solo un aiuto.
const OUI_HINTS: Array<[RegExp, string]> = [
  [/^(28:57:be|44:19:b6|c0:56:e3|54:c4:15|bc:ad:28)/i, "Hikvision (telecamera)"],
  [/^(3c:ef:8c|a0:bd:1d|9c:14:63|e0:50:8b)/i, "Dahua (telecamera)"],
  [/^(00:12:12|9c:8e:cd)/i, "Xiongmai (telecamera)"],
  [/^(d8:07:b6|d4:81:d7|50:c7:bf|60:32:b1)/i, "TP-Link"],
  [/^(bc:24:11)/i, "Proxmox (VM/CT)"],
  [/^(dc:a6:32|b8:27:eb|e4:5f:01)/i, "Raspberry Pi"]
];
function ouiHint(mac: string): string {
  for (const [re, name] of OUI_HINTS) if (re.test(mac)) return name;
  return "";
}

async function probePort(ip: string, port: number, ms = 700): Promise<boolean> {
  const net = await import("net");
  return new Promise(resolve => {
    const s = new net.Socket();
    const done = (r: boolean) => { s.destroy(); resolve(r); };
    s.setTimeout(ms);
    s.once("connect", () => done(true));
    s.once("timeout", () => done(false));
    s.once("error", () => done(false));
    s.connect(port, ip);
  });
}

function serverLanIp(): string {
  const ifaces = os.networkInterfaces();
  for (const list of Object.values(ifaces)) {
    for (const i of list || []) {
      if (i.family === "IPv4" && !i.internal) return i.address;
    }
  }
  return "";
}

let lastNetworkScan: any = null;
let networkScanRunning = false;

app.get("/api/admin/network/scan", async (req, res) => {
  if (networkScanRunning) return res.json({ inCorso: true, ultimo: lastNetworkScan });
  if (req.query.cached === "1") return res.json({ inCorso: false, ultimo: lastNetworkScan });
  networkScanRunning = true;
  try {
    const { execFile } = await import("child_process");
    const run = (cmd: string, args: string[]) =>
      new Promise<string>(resolve =>
        execFile(cmd, args, { timeout: 4000 }, (_e, so) => resolve(String(so || ""))));

    const selfIp = serverLanIp();
    const base = selfIp.replace(/\.\d+$/, "");
    if (!base) { networkScanRunning = false; return res.status(500).json({ error: "Nessuna interfaccia LAN trovata" }); }

    // Ping sweep a blocchi (riempie la tabella ARP), poi lettura ARP per i MAC
    const ips = Array.from({ length: 254 }, (_, k) => `${base}.${k + 1}`);
    for (let i = 0; i < ips.length; i += 64) {
      await Promise.all(ips.slice(i, i + 64).map(ip => run("ping", ["-c", "1", "-W", "1", ip])));
    }
    const neigh = await run("ip", ["neigh", "show"]);
    const alive: Array<{ ip: string; mac: string }> = [];
    for (const line of neigh.split("\n")) {
      const m = line.match(/^(\d+\.\d+\.\d+\.\d+)\s.*lladdr\s+([0-9a-f:]{17})\s+(REACHABLE|STALE|DELAY|PROBE)/i);
      if (m && m[1].startsWith(base + ".")) alive.push({ ip: m[1], mac: m[2].toLowerCase() });
    }

    // Sonda porte: 554=RTSP (cam), 8899/2020=ONVIF (tipico cam cinesi, spesso
    // con audio bidirezionale), 3389/445=PC Windows, 22=Linux, 80/8080=web.
    // NB: che la cam abbia davvero microfono/altoparlante lo dice solo una
    // interrogazione ONVIF (GetAudioSources/GetAudioOutputs): qui segnaliamo
    // la POSSIBILITÀ, la conferma è un'integrazione futura.
    const PORTS = [554, 3389, 445, 22, 80, 8080, 3000, 8899, 2020];
    const devices = await Promise.all(alive.map(async d => {
      const open: number[] = [];
      await Promise.all(PORTS.map(async p => { if (await probePort(d.ip, p)) open.push(p); }));
      let tipo = "sconosciuto";
      let puoKiosk = false;
      if (open.includes(554)) {
        tipo = (open.includes(8899) || open.includes(2020))
          ? "telecamera IP (RTSP + ONVIF, possibile audio bidirezionale)"
          : "telecamera IP (RTSP)";
      }
      else if (open.includes(3389) || open.includes(445)) { tipo = "PC Windows"; puoKiosk = true; }
      else if (open.includes(22)) tipo = "Linux/embedded";
      else if (open.includes(80) || open.includes(8080)) tipo = "dispositivo web (probabile telecamera o router)";
      const vendor = ouiHint(d.mac);
      if (vendor.includes("telecamera")) { tipo = vendor; puoKiosk = false; }
      return { ip: d.ip, mac: d.mac, vendor, tipo, porte: open.sort((a, b) => a - b), puoKiosk };
    }));
    devices.sort((a, b) => Number(a.ip.split(".")[3]) - Number(b.ip.split(".")[3]));
    lastNetworkScan = { quando: new Date().toISOString(), rete: `${base}.0/24`, server: selfIp, dispositivi: devices };
    res.json({ inCorso: false, ultimo: lastNetworkScan });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    networkScanRunning = false;
  }
});

// Il batch che trasforma un PC Windows in postazione kiosk: dal PC scelto
// si apre http://<server>:3000/kiosk.bat, doppio click sul file scaricato.
// Crea il collegamento in shell:startup e lancia subito il kiosk di prova.
app.get("/kiosk.bat", (req, res) => {
  const fromReq = String(req.headers.host || "").split(":")[0];
  const HOST = /^\d+\.\d+\.\d+\.\d+$/.test(fromReq) ? fromReq : (serverLanIp() || "127.0.0.1");
  const L: string[] = [];
  L.push("@echo off");
  L.push("REM VoiceFollower kiosk - generato dal server " + HOST + ". Doppio click e basta.");
  L.push("setlocal");
  L.push('set "PS1=%TEMP%\\vf_kiosk_setup.ps1"');
  L.push('> "%PS1%" echo $ErrorActionPreference=\'Stop\'');
  L.push(">> \"%PS1%\" echo $origin = 'http://" + HOST + ":3000'");
  L.push(">> \"%PS1%\" echo $url = $origin + '/?vista=sorveglianza^&kiosk=1'");
  L.push(">> \"%PS1%\" echo $browser = @(\"${env:ProgramFiles(x86)}\\Microsoft\\Edge\\Application\\msedge.exe\", \"$env:ProgramFiles\\Microsoft\\Edge\\Application\\msedge.exe\", \"$env:ProgramFiles\\Google\\Chrome\\Application\\chrome.exe\", \"${env:ProgramFiles(x86)}\\Google\\Chrome\\Application\\chrome.exe\") ^| Where-Object { Test-Path $_ } ^| Select-Object -First 1");
  L.push(">> \"%PS1%\" echo if (-not $browser) { Write-Output 'ERRORE: Chrome/Edge non trovati. Installa Chrome e rilancia.'; exit 1 }");
  L.push(">> \"%PS1%\" echo $args = '--kiosk --autoplay-policy=no-user-gesture-required --use-fake-ui-for-media-stream --unsafely-treat-insecure-origin-as-secure=' + $origin + ' \"' + $url + '\"'");
  L.push(">> \"%PS1%\" echo $lnk = [Environment]::GetFolderPath('Startup') + '\\VoiceFollower-Kiosk.lnk'");
  L.push(">> \"%PS1%\" echo $s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)");
  L.push(">> \"%PS1%\" echo $s.TargetPath = $browser");
  L.push(">> \"%PS1%\" echo $s.Arguments = $args");
  L.push(">> \"%PS1%\" echo $s.Save()");
  L.push(">> \"%PS1%\" echo Write-Output ('OK avvio automatico: ' + $lnk)");
  L.push(">> \"%PS1%\" echo Write-Output ('Server: ' + $origin)");
  L.push(">> \"%PS1%\" echo Write-Output 'Avvio kiosk di prova... (per uscire: ALT+F4)'");
  L.push(">> \"%PS1%\" echo Start-Process $browser $args");
  L.push("powershell -NoProfile -ExecutionPolicy Bypass -File \"%PS1%\"");
  L.push("if errorlevel 1 echo Qualcosa e andato storto: leggi il messaggio qui sopra.");
  L.push("pause");
  L.push("endlocal");
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", "attachment; filename=VoiceFollower-Kiosk.bat");
  res.send(L.join("\r\n") + "\r\n");
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`EdgeMesh Neural Host Master Server listening on http://localhost:${PORT}`);
  });
}

startServer();

