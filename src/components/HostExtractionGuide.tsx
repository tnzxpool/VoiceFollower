import React, { useState } from "react";
import { 
  Download, 
  Terminal, 
  Server, 
  Database, 
  ShieldCheck, 
  FileCode, 
  Layers, 
  Check, 
  Copy,
  ExternalLink,
  Cpu,
  RefreshCw,
  FolderArchive
} from "lucide-react";
import { AdminConfig } from "../types";

interface Props {
  adminConfig: AdminConfig;
}

export const HostExtractionGuide: React.FC<Props> = ({ adminConfig }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 3000);
  };

  const handleDownloadExport = (format: "json" | "sql") => {
    setIsExporting(true);
    window.location.href = `/api/admin/export?format=${format}`;
    setTimeout(() => setIsExporting(false), 2000);
  };

  const dockerComposeSnippet = `version: "3.8"

services:
  # 1. Host Master EdgeMesh Orchestrator
  edgemesh-master:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: edgemesh-host-master
    restart: unless-stopped
    ports:
      - "3000:3000"      # Web Master UI & REST API
      - "50051:50051"    # Duplex Wi-Fi Gateway
    environment:
      - NODE_ENV=production
      - GEMINI_API_KEY=\${GEMINI_API_KEY:-""}
      - DEEPSEEK_API_KEY=\${DEEPSEEK_API_KEY:-""}
      - GLM_API_KEY=\${GLM_API_KEY:-""}
      - LOCAL_LLM_ENDPOINT=http://ollama:11434/v1
      - LOCAL_LLM_MODEL=qwen2.5:7b-instruct
    depends_on:
      - memgraph
      - ollama
    networks:
      - mesh-net

  # 2. Grafo di Conoscenza Persistente (Memgraph / Neo4j)
  memgraph:
    image: memgraph/memgraph:latest
    container_name: edgemesh-graph-db
    ports:
      - "7687:7687"
      - "7474:7474"
    volumes:
      - mg_data:/var/lib/memgraph
    networks:
      - mesh-net

  # 3. LLM Locale Residente su Host (Ollama / DeepSeek-R1 / Qwen2.5)
  ollama:
    image: ollama/ollama:latest
    container_name: edgemesh-local-llm
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    # Se hai GPU NVIDIA sul server privato:
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: all
    #           capabilities: [gpu]
    networks:
      - mesh-net

networks:
  mesh-net:
    driver: bridge

volumes:
  mg_data:
  ollama_data:`;

  const nodeRunSnippet = `# 1. Clona o estrai i sorgenti sul server privato
git clone <tuo-repo-o-zip> edgemesh-master
cd edgemesh-master

# 2. Installa le dipendenze
npm install

# 3. Configura le variabili d'ambiente (.env)
cat << 'EOF' > .env
PORT=3000
GEMINI_API_KEY=tuo_gemini_key
DEEPSEEK_API_KEY=tuo_deepseek_key
GLM_API_KEY=tuo_glm_key
LOCAL_LLM_ENDPOINT=http://127.0.0.1:11434/v1
LOCAL_LLM_MODEL=qwen2.5:7b-instruct
EOF

# 4. Avvia il server Master
npm run build
npm start`;

  return (
    <div id="host-extraction-guide" className="space-y-6">
      {/* Overview Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Estrazione Dati Sandbox & Distribuzione su Server Host Privato
            </h2>
            <p className="text-xs text-slate-500">
              Guida operativa completa per esportare il database dei dialetti, il grafo di conoscenza e ospitare l'applicazione su una macchina fisica o VPS dedicata.
            </p>
          </div>
        </div>

        {/* Action Buttons to Export */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleDownloadExport("json")}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Esporta Snapshot Completo (.JSON)</span>
          </button>

          <button
            onClick={() => handleDownloadExport("sql")}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-xs"
          >
            <Database className="w-4 h-4 text-indigo-600" />
            <span>Scarica Schema & Dati SQL (.SQL)</span>
          </button>
        </div>
      </div>

      {/* Step by Step Guide */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Box 1: Architettura Host Master Privata */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Cpu className="w-4 h-4 text-indigo-600" />
            <span>1. Architettura Host Indipendente Multi-LLM</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            L'applicazione non dipende esclusivamente da Gemini: include un bridge agnostico compatibile OpenAI/REST in <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600">server.ts</code> in grado di pilotare:
          </p>
          <ul className="space-y-1.5 text-xs text-slate-700">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
              <span><strong>DeepSeek-V3 / DeepSeek-R1</strong>: tramite chiave API Cloud standard.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
              <span><strong>GLM-4 (Zhipu AI)</strong>: tramite endpoint multimodale.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
              <span><strong>Ollama / vLLM Locale</strong>: residente sul medesimo server Linux/Mac (senza connessione internet).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
              <span><strong>Fallback Quantizzato INT4</strong>: motore NPU a 14ms integrato per operare totalmente air-gapped.</span>
            </li>
          </ul>
        </div>

        {/* Box 2: Collegamento Terminali Wi-Fi Slave */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>2. Connessione Terminali Slave (Smartphone / Watch)</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            I terminali Slave di ascolto e risposta (smartphone, smartwatch) si collegano all'Host Master tramite Wi-Fi locale:
          </p>
          <ul className="space-y-1.5 text-xs text-slate-700">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <span><strong>IP Host Fisso</strong>: configura l'host con IP statico (es. <code className="bg-slate-100 px-1 py-0.5 rounded">{adminConfig.masterHostIp || "192.168.1.120"}</code>).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <span><strong>Crittografia ChaCha20</strong>: i flussi audio PCM sub-20ms e i pacchetti aptici transitano protetti su rete Wi-Fi privata.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <span><strong>Doppia Catalogazione</strong>: ogni nuova parola dialettale catturata dallo slave viene registrata nel DB e arricchisce il Grafo dell'Host.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Code Snippets for Deployment */}
      <div className="space-y-4">
        {/* Docker Compose File */}
        <div className="bg-slate-900 text-slate-200 rounded-xl p-4 font-mono text-xs border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-slate-300 font-sans font-semibold">
              <FileCode className="w-4 h-4 text-indigo-400" />
              <span>File docker-compose.yml per Server Privato</span>
            </div>
            <button
              onClick={() => copyToClipboard(dockerComposeSnippet, "docker")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
            >
              {copiedKey === "docker" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === "docker" ? "Copiato!" : "Copia Docker Compose"}</span>
            </button>
          </div>
          <pre className="overflow-x-auto text-[11px] leading-relaxed text-slate-300">
            {dockerComposeSnippet}
          </pre>
        </div>

        {/* Direct Node.js Startup */}
        <div className="bg-slate-900 text-slate-200 rounded-xl p-4 font-mono text-xs border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-slate-300 font-sans font-semibold">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>Comandi di Avvio Diretto Node.js / Linux</span>
            </div>
            <button
              onClick={() => copyToClipboard(nodeRunSnippet, "node")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
            >
              {copiedKey === "node" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === "node" ? "Copiato!" : "Copia Comandi"}</span>
            </button>
          </div>
          <pre className="overflow-x-auto text-[11px] leading-relaxed text-slate-300">
            {nodeRunSnippet}
          </pre>
        </div>
      </div>
    </div>
  );
};
