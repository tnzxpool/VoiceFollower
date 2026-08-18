export type NodeRole = 
  | "AV_TERMINAL"
  | "HAPTIC_BAND"
  | "TACTILE_ARRAY"
  | "SENSOR_POD"
  | "CENTRAL_CPU"
  | "QUANTIZED_NPU";

export type VoiceLanguage = "it-IT" | "en-US";

export type TTSEngineType = 
  | "KOKORO_82M_NEURAL" 
  | "PIPER_VITS_ITALIAN" 
  | "XTTS_V2_GPU" 
  | "WEB_SPEECH_LEGACY";

export interface GpuServerConfig {
  serverIp: string;
  serverPort: number;
  gpuModelName: string;
  totalVramGb: number;
  usedVramGb: number;
  gpuTemperatureC: number;
  cudaVersion: string;
  activeTtsModel: string;
  activeLlmModel: string;
  online: boolean;
}

export interface HomeScenario {
  id: string;
  name: string;
  code: string;
  icon: string;
  description: string;
  category: "COMFORT" | "SICUREZZA" | "CLIMA" | "NOTTE" | "RAPIDO";
  active: boolean;
  hapticFeedbackPattern: HapticPattern;
  associatedSpokenFeedback: string;
  voiceStyle: "NATURAL_WARM" | "TACTICAL_WHISPER" | "ENERGETIC";
}

export interface HomeRoom {
  id: string;
  name: string;
  icon: string;
  temperatureC: number;
  humidityPct: number;
  lightsActiveCount: number;
  totalLightsCount: number;
  activeSlaveDevice?: string;
  statusText: string;
}

export type DialectCategory = 
  | "DIALETTO_REGIONALE" 
  | "GERGO_OPERATIVO" 
  | "PAROLA_INVENTATA" 
  | "VOCALIZZO_VERSO" 
  | "TERMINE_ESTERO";

export interface DialectToken {
  id: string;
  term: string;
  sourceSlaveId: string;
  sourceSlaveName: string;
  category: DialectCategory;
  standardMeaning: string;
  phoneticAlt: string;
  confidence: number;
  sampleAudioTextContext: string;
  status: "APPRESO_ATTIVO" | "IN_ATTESA_SIGNIFICATO" | "VALIDATO_MASTER";
  catalogedInDb: boolean;
  catalogedInGraph: boolean;
  graphConnections: string[]; // Linked concepts in knowledge graph
  foreignEquivalents?: string[];
  inventedEtymology?: string;
  occurrenceCount: number;
  lastHeardAt: string;
}

export interface AdminConfig {
  masterNodeName: string;
  masterHostIp: string;
  gpuServerIp: string;
  gpuServerPort: number;
  ttsEngine: TTSEngineType;
  ttsHuggingFaceModel: string;
  geminiApiKey: string;
  deepseekApiKey: string;
  glmApiKey: string;
  anthropicApiKey?: string;
  anthropicModel?: string;
  localLlmEndpoint: string;
  localLlmApiKey?: string;
  localLlmUsername?: string;
  localLlmPassword?: string;
  localLlmModel: string;
  primaryProvider: "gemini" | "deepseek" | "glm" | "claude" | "local_ollama";
  fallbackProvider: "local_ollama" | "deepseek" | "gemini" | "airgap_int4";
  autoLearnDialects: boolean;
  masterRequireAuth: boolean;
  databaseStorageType: "SQL_RELATIONAL" | "GRAPH_EMBEDDED";
  syncIntervalSec: number;
}

export type OperationalViewMode =
  | "COMPANION_ALZHEIMER"
  | "CAREGIVER_MASTER"
  | "SURVEILLANCE"
  | "HOME_USER"
  | "ADVANCED_TRAINING";

export type SurveillanceEventType = "MOVIMENTO" | "RUMORE_FORTE" | "SILENZIO_ANOMALO";

export interface SurveillanceEvent {
  id: string;
  timestamp: string;
  type: SurveillanceEventType;
  sourceLabel: string;
  detail: string;
  snapshot?: string;
  aiAnalysis?: string;
  alertId?: string;
}

export interface ClientSlaveSession {
  id: string;
  name: string;
  ip: string;
  mac?: string;
  deviceType: "SMARTPHONE" | "TABLET" | "SMARTWATCH" | "SMART_DISPLAY" | "MICROPHONE_ARRAY";
  status: "ONLINE" | "DISCONNECTED" | "STREAMING";
  batteryPct: number;
  wifiSignalDbm: number;
  isAuthorized: boolean;
  autonomousSessionEnabled: boolean;
  audioStreamRxEnabled: boolean; // Master listens to client mic
  audioStreamTxEnabled: boolean; // Master speaks to client speaker
  videoStreamRxEnabled: boolean; // Camera feed enabled
  videoStreamTxEnabled: boolean; // Display visual companion
  volumeLevel: number;
  lastActiveTime: string;
  assignedRoom: string;
  activePromptStyle?: "CALM_REASSURING" | "FAMILIAR_WARM" | "SHORT_SIMPLE";
}

export interface BiographicalMemoryEntry {
  id: string;
  category: "FAMILY_MEMBER" | "SPECIAL_MEMORY" | "COMFORT_ROUTINE" | "FAVORITE_SONG" | "HOMETOWN" | "PET" | "SPECIAL_WORD";
  title: string;
  description: string;
  emotionalValence: "CALMING" | "JOY" | "ANCHOR";
  relationOrTopic?: string;
  photoUrl?: string;
  linkedGraphNodeId?: string;
  frequencyTriggered: number;
  lastRecalledAt?: string;
}

export interface CaregiverAlert {
  id: string;
  timestamp: string;
  severity: "INFO" | "ATTENTION" | "DISORIENTATION" | "URGENT";
  title: string;
  description: string;
  detectedPhrase?: string;
  sourceDevice: string;
  resolved: boolean;
}

export interface ProxmoxServerInfo {
  ddnsDomain: string;
  lanIp: string;
  serverModel: string;
  gpuModel: string;
  vramTotalGb: number;
  vramUsedGb: number;
  gpuTempC: number;
  ollamaStatus: boolean;
  whisperSttStatus: boolean;
  kokoroTtsStatus: boolean;
  activeModel: string;
  isReachable: boolean;
}

export interface CustomVocabEntry {
  id?: string;
  phrase: string;
  phoneticAlt?: string;
  phoneticHint?: string;
  replaceWith?: string;
  boost?: number;
}

export interface CalibrationStatus {
  isCalibrated: boolean;
  averagePitchHz: number;
  sampleSnrDb: number;
  calibratedDate?: string;
  sampleCount: number;
}

export interface SpeakerVoiceProfile {
  id?: string;
  speakerName: string;
  language: VoiceLanguage;
  pitch: number; // 0.5 - 2.0 (default 1.0)
  rate?: number; // 0.5 - 2.0 (default 1.0)
  speakingRate?: number; // alias for rate
  f0FundamentalHz?: number; // Estimated baseline F0 in Hz (e.g. 120-220Hz)
  vowelFormantBoost?: number; // 0.8 - 1.5
  formantResonance?: "WARM_BASS" | "NATURAL" | "CRISP_PRESENCE" | "TELEMETRY_RADIO";
  speechCadence?: "ADAPTIVE_FAST" | "BALANCED_TACTICAL" | "CLEAR_DELIBERATE";
  vadSensitivity?: number; // 0.1 - 1.0
  silenceThresholdMs?: number; // ms to detect end of speech
  noiseGateDb?: number; // -60dB to -20dB
  noiseSuppression?: boolean;
  accentRegion?: string;
  responsePersona?: "TACTICAL_CONCISE" | "TECHNICAL_ANALYTICAL" | "EMPATHIC_EXPLANATORY" | "DIRECT_OPERATOR";
  calibrationStatus?: CalibrationStatus;
  customVocabulary: CustomVocabEntry[];
}


export interface EdgeNode {
  id: string;
  name: string;
  role: NodeRole;
  status: "ONLINE" | "TRANSMITTING" | "STANDBY" | "OFFLINE";
  ip: string;
  frequency: string;
  signalDbm: number;
  latencyMs: number;
  batteryPct: number;
  encryption: "AES-256-GCM" | "ChaCha20" | "UNENCRYPTED";
  packetsProcessed: number;
  coordinates: { x: number; y: number };
}

export type HapticPattern = 
  | "CONFIRMATION_PULSE"
  | "ATTENTION_WARNING"
  | "DIRECTIONAL_SWEEP"
  | "HEARTBEAT_RHYTHM"
  | "NONE";

export interface HapticAction {
  targetNode: string;
  pattern: HapticPattern;
  intensity: number; // 0.0 - 1.0
  durationMs: number;
  hapticDescription: string;
  frequencyHz?: number;
}

export interface TaskStep {
  stepId: string;
  title: string;
  assignedUnit: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  category: "entity" | "peripheral" | "memory" | "task" | "policy";
  attributes: Record<string, any>;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface KnowledgeGraphEdge {
  source: string | KnowledgeGraphNode;
  target: string | KnowledgeGraphNode;
  relation: string;
  weight: number;
}

export interface RAGDocument {
  id: string;
  title: string;
  category: string;
  content: string;
}

export interface MicroserviceContainer {
  id: string;
  name: string;
  image: string;
  status: "running" | "stopped" | "restarting" | "standby_ready";
  port: number;
  cpu: string;
  mem: string;
  latency: string;
  encrypted: boolean;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "central_cpu" | "edge_orchestrator" | "offline_npu";
  text: string;
  timestamp: string;
  audioBase64?: string;
  hapticAction?: HapticAction;
  modelUsed?: string;
  thinkingMode?: string;
  latencyMs?: number;
  taskPlan?: TaskStep[];
  knowledgeGraphUpdates?: Array<{ nodeLabel: string; category: string; relationTo: string }>;
  quantizedOfflineCompatible?: boolean;
  visualSnapshot?: string;
}

export interface DuplexPacket {
  id: string;
  timestamp: number;
  source: string;
  target: string;
  payloadType: "VOICE_PCM" | "H265_FRAME" | "HAPTIC_PDM" | "GRAPH_SYNC" | "TELEMETRY";
  sizeBytes: number;
  encrypted: boolean;
}




