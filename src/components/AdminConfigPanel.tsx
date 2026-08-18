import React, { useState } from "react";
import { 
  Key, 
  Cpu, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  ShieldAlert, 
  Sliders, 
  Layers, 
  Network,
  RotateCcw,
  Sparkles,
  Bot
} from "lucide-react";
import { AdminConfig } from "../types";
import { triggerHapticFeedback } from "../utils/haptics";
import { SetupWizard } from "./SetupWizard";

interface Props {
  config: AdminConfig;
  onUpdateConfig: (updated: AdminConfig) => void;
}

export const AdminConfigPanel: React.FC<Props> = ({ config, onUpdateConfig }) => {
  const [formData, setFormData] = useState<AdminConfig>(config);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [ollamaInfo, setOllamaInfo] = useState<any>(null);
  const [ollamaLoading, setOllamaLoading] = useState<boolean>(false);
  const [showWizard, setShowWizard] = useState<boolean>(false);

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        onUpdateConfig(data.config);
        setSaveSuccess(true);
        triggerHapticFeedback("CONFIRMATION_PULSE", 0.7, 100);
        setTimeout(() => setSaveSuccess(false), 3500);
      }
    } catch (err: any) {
      alert("Errore salvataggio config: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const fetchOllamaModels = async () => {
    setOllamaLoading(true);
    try {
      const res = await fetch("/api/ollama/models");
      setOllamaInfo(await res.json());
    } catch {
      setOllamaInfo({ reachable: false, models: [], error: "Errore di rete verso il Master Host" });
    } finally {
      setOllamaLoading(false);
    }
  };

  React.useEffect(() => {
    fetchOllamaModels();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveConfig();
  };

  const handleTestProvider = async () => {
    setTestResult("Test di orchestrazione con il provider selezionato in corso...");
    try {
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Verifica stato host master e modello neurale attivo",
          providerOverride: formData.primaryProvider,
          useHighThinking: false
        })
      });
      const data = await res.json();
      setTestResult(
        `Risposta dal provider [${data.modelUsed}]: "${data.spokenResponse}" (Latenza: ${data.latencyMs}ms)`
      );
      triggerHapticFeedback("CONFIRMATION_PULSE", 0.8, 120);
    } catch (err: any) {
      setTestResult("Errore durante il test di inferenza: " + err.message);
    }
  };

  const handleResetData = async (target: "dialects" | "graph") => {
    if (!window.confirm(`Sei sicuro di voler resettare ${target === "dialects" ? "i dialetti dinamici" : "il grafo semantico"}?`)) {
      return;
    }
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target })
      });
      const data = await res.json();
      alert(data.message || "Reset completato.");
      window.location.reload();
    } catch (err: any) {
      alert("Errore reset: " + err.message);
    }
  };

  return (
    <div id="admin-config-panel" className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Configurazione Motori Neurale & Chiavi API Host
            </h2>
            <p className="text-xs text-slate-500">
              Imposta chiavi API private per Gemini, DeepSeek, GLM o endpoint locale Ollama/vLLM.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Configurazione Salvata!</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowWizard(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${showWizard ? "bg-indigo-600 text-white border-indigo-600" : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"}`}
          >
            <Sparkles className="w-4 h-4" />
            {showWizard ? "Nascondi procedura guidata" : "Procedura guidata"}
          </button>
        </div>
      </div>

      {showWizard && (
        <SetupWizard
          formData={formData}
          setFormData={setFormData}
          onSave={saveConfig}
          onClose={() => setShowWizard(false)}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Provider Selection */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-600" />
            <span>Selezione Provider LLM Pilota & Strategia di Fallback</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Provider Primario Preferito
              </label>
              <select
                value={formData.primaryProvider}
                onChange={e => setFormData({ ...formData, primaryProvider: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="gemini">Google Gemini (3.7-Flash / Flash-Latest con High-Thinking)</option>
                <option value="deepseek">DeepSeek (DeepSeek-V3 / DeepSeek-R1)</option>
                <option value="glm">GLM (Zhipu AI GLM-4 Flash)</option>
                <option value="claude">Claude (Anthropic — orchestrazione test, GPU locale non toccata)</option>
                <option value="local_ollama">LLM Locale / Portale R740 Residente sull'Host</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Strategia Fallback in caso di Quota o Disconnessione
              </label>
              <select
                value={formData.fallbackProvider}
                onChange={e => setFormData({ ...formData, fallbackProvider: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="local_ollama">Ollama Locale → Fallback INT4 Quantizzato</option>
                <option value="deepseek">DeepSeek → Fallback INT4 Quantizzato</option>
                <option value="gemini">Gemini Flash → Fallback INT4 Quantizzato</option>
                <option value="airgap_int4">Diretto su NPU Locale INT4 (Air-Gap)</option>
              </select>
            </div>
          </div>
        </div>

        {/* API Keys Configuration Grid */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-600" />
            <span>Chiavi API Segrete dei Fornitori (Salvate solo in memoria Host)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Gemini API Key */}
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Google Gemini API Key
              </label>
              <input
                type="password"
                value={formData.geminiApiKey}
                onChange={e => setFormData({ ...formData, geminiApiKey: e.target.value })}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-[11px]"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Default gestito da environment di sistema.
              </span>
            </div>

            {/* DeepSeek API Key */}
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                DeepSeek API Key
              </label>
              <input
                type="password"
                value={formData.deepseekApiKey}
                onChange={e => setFormData({ ...formData, deepseekApiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-[11px]"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Per DeepSeek-V3 o DeepSeek-R1.
              </span>
            </div>

            {/* GLM API Key */}
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                GLM (Zhipu AI) API Key
              </label>
              <input
                type="password"
                value={formData.glmApiKey}
                onChange={e => setFormData({ ...formData, glmApiKey: e.target.value })}
                placeholder="glm-key..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-[11px]"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Per modelli GLM-4 multimodali.
              </span>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Anthropic API Key (Claude)
              </label>
              <input
                type="password"
                value={formData.anthropicApiKey || ""}
                onChange={e => setFormData({ ...formData, anthropicApiKey: e.target.value })}
                placeholder="sk-ant-..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-[11px]"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Orchestrazione temporanea per i test (modello: claude-haiku-4-5).
              </span>
            </div>
          </div>

          {/* Local Ollama / vLLM Endpoint */}
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Endpoint LLM Locale Residente (Ollama / vLLM)
              </label>
              <input
                type="text"
                value={formData.localLlmEndpoint}
                onChange={e => setFormData({ ...formData, localLlmEndpoint: e.target.value })}
                placeholder="http://localhost:11434/v1"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-[11px]"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Nome Modello Locale Scaricato
              </label>
              <input
                type="text"
                value={formData.localLlmModel}
                onChange={e => setFormData({ ...formData, localLlmModel: e.target.value })}
                placeholder="qwen2.5:7b-instruct, deepseek-r1:8b..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-[11px]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">
                Token / API Key LLM Locale (richiesto da R740 AI Factory — admin_token; vuoto per Ollama)
              </label>
              <input
                type="password"
                value={formData.localLlmApiKey || ""}
                onChange={e => setFormData({ ...formData, localLlmApiKey: e.target.value })}
                placeholder="contenuto di secrets/admin_token sul server .88"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-[11px]"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Username Portale LLM (login sessione)
              </label>
              <input
                type="text"
                value={formData.localLlmUsername || ""}
                onChange={e => setFormData({ ...formData, localLlmUsername: e.target.value })}
                placeholder="guest"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-[11px]"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Password Portale R740
              </label>
              <input
                type="password"
                value={formData.localLlmPassword || ""}
                onChange={e => setFormData({ ...formData, localLlmPassword: e.target.value })}
                placeholder="password account portale"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-[11px]"
              />
            </div>
          </div>

          {/* Modelli REALMENTE installati sul nodo Ollama */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <label className="block font-medium text-slate-700 text-xs">
                Modelli installati sul nodo GPU (verifica reale via /api/tags)
              </label>
              <button
                type="button"
                onClick={fetchOllamaModels}
                disabled={ollamaLoading}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
              >
                {ollamaLoading ? "Interrogo il nodo..." : "↻ Aggiorna elenco"}
              </button>
            </div>
            {ollamaInfo && !ollamaInfo.reachable && (
              <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5 font-mono">
                {ollamaInfo.error}
              </p>
            )}
            {ollamaInfo && ollamaInfo.reachable && ollamaInfo.models.length === 0 && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                Nodo raggiungibile ma NESSUN modello scaricato. Sul server esegui ad es.:{" "}
                <code className="font-mono">ollama pull qwen2.5:7b-instruct</code>
              </p>
            )}
            {ollamaInfo && ollamaInfo.reachable && ollamaInfo.models.length > 0 && (
              <div className="space-y-1.5">
                {ollamaInfo.models.map((m: any) => (
                  <button
                    key={m.name}
                    type="button"
                    onClick={() => setFormData({ ...formData, localLlmModel: m.name })}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-[11px] font-mono transition-all ${
                      formData.localLlmModel === m.name
                        ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:border-indigo-300"
                    }`}
                  >
                    <span>
                      {formData.localLlmModel === m.name ? "● " : "○ "}
                      {m.name}
                    </span>
                    <span className="text-slate-400">
                      {m.parameterSize || ""} {m.quantization || ""} {m.sizeGb ? `${m.sizeGb} GB` : ""}
                    </span>
                  </button>
                ))}
                {!ollamaInfo.activeModelInstalled && (
                  <p className="text-[11px] text-amber-700">
                    Attenzione: il modello attivo "{ollamaInfo.activeModel}" non risulta tra quelli
                    scaricati — selezionane uno dall'elenco.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* GPU Server 192.168.1.88 & Hugging Face Neural TTS */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-600" />
              <span>Server GPU Dedicato (Host 192.168.1.88) & Sintetizzatore Neurale Hugging Face</span>
            </h3>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
              CUDA 12.4 • RTX 4080 (16GB VRAM)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Indirizzo IP Server GPU
              </label>
              <input
                type="text"
                value={formData.gpuServerIp || "192.168.1.88"}
                onChange={e => setFormData({ ...formData, gpuServerIp: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-[11px]"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Porta Demone TTS / GPU
              </label>
              <input
                type="number"
                value={formData.gpuServerPort || 8000}
                onChange={e => setFormData({ ...formData, gpuServerPort: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-[11px]"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Motore TTS Neurale Predefinito
              </label>
              <select
                value={formData.ttsEngine || "KOKORO_82M_NEURAL"}
                onChange={e => setFormData({ ...formData, ttsEngine: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="KOKORO_82M_NEURAL">Kokoro-82M (v0.19 Neurale HD, 82M parametri)</option>
                <option value="PIPER_VITS_ITALIAN">Piper VITS (it_IT-riccardo-medium / Veloce)</option>
                <option value="XTTS_V2_GPU">Coqui XTTS-v2 (GPU 16GB VRAM)</option>
                <option value="WEB_SPEECH_LEGACY">Web Speech Standard (Fallback)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2 border-t border-slate-100">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Repository Modello Hugging Face per TTS
              </label>
              <input
                type="text"
                value={formData.ttsHuggingFaceModel || "hexgrad/Kokoro-82M-v0.19-it"}
                onChange={e => setFormData({ ...formData, ttsHuggingFaceModel: e.target.value })}
                placeholder="hexgrad/Kokoro-82M-v0.19-it"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-[11px]"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Download e caching automatico nella cartella /models dell'host privato.
              </span>
            </div>

            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={() => {
                  fetch("/api/gpu/status")
                    .then(r => r.json())
                    .then(d => {
                      alert(`Stato Server GPU:\nModello: ${d.gpuModelName}\nCUDA: ${d.cudaVersion}\nVRAM Usata: ${d.usedVramGb}GB / ${d.totalVramGb}GB\nTemp: ${d.gpuTemperatureC}°C\nModello TTS: ${d.activeTtsModel}`);
                    })
                    .catch(e => alert("Errore connessione GPU: " + e.message));
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs transition-colors shadow-2xs"
              >
                Interroga Telemetria VRAM GPU (192.168.1.88)
              </button>
            </div>
          </div>
        </div>

        {/* Modelli locali (download dal pannello admin) */}
        <ModelsCard />

      <NetworkKioskCard />

        {/* Master Host Network & Storage */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
            <Network className="w-4 h-4 text-indigo-600" />
            <span>Parametri di Rete Host Master & Autenticazione Slave</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Nome Nodo Master
              </label>
              <input
                type="text"
                value={formData.masterNodeName}
                onChange={e => setFormData({ ...formData, masterNodeName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Indirizzo IP Statico Host Master
              </label>
              <input
                type="text"
                value={formData.masterHostIp}
                onChange={e => setFormData({ ...formData, masterHostIp: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Apprendimento Attivo Dialetti Automatico
              </label>
              <select
                value={formData.autoLearnDialects ? "true" : "false"}
                onChange={e => setFormData({ ...formData, autoLearnDialects: e.target.value === "true" })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="true">Attivo (Disambigua parole sconosciute)</option>
                <option value="false">Disattivato</option>
              </select>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestProvider}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Bot className="w-4 h-4 text-indigo-600" />
              <span>Test Inferenza con Provider Selezionato</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "Salvataggio..." : "Salva Configurazione Master"}</span>
            </button>
          </div>
        </div>
      </form>

      {testResult && (
        <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-950 text-xs font-mono">
          {testResult}
        </div>
      )}

      {/* Database & Graph Maintenance Purge */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <RotateCcw className="w-4 h-4 text-rose-600" />
          <span>Manutenzione e Reset Memoria Host</span>
        </h4>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => handleResetData("dialects")}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 transition-colors"
          >
            Ripristina Tabella Dialetti
          </button>
          <button
            type="button"
            onClick={() => handleResetData("graph")}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 transition-colors"
          >
            Ripristina Grafo Semantico
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
 * Modelli locali — download dal pannello admin (tipo file dichiarato)
 * GET  /api/admin/models            → liste + orchestratore attivo + job
 * POST /api/admin/models/download   → { url, expectedType }
 * POST /api/admin/models/activate   → { file } (solo GGUF)
 * ============================================================ */
const MODEL_TYPE_OPTIONS = [
  { value: "gguf", label: "Orchestratore locale — file .gguf (llama.cpp)" },
  { value: "pt", label: "Pesi visione — file .pt (PyTorch)" },
  { value: "wav", label: "Campione voce — file .wav" }
];

const ModelsCard: React.FC = () => {
  const [info, setInfo] = useState<any>(null);
  const [url, setUrl] = useState("");
  const [tipo, setTipo] = useState("gguf");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch("/api/admin/models");
      setInfo(await res.json());
    } catch {
      setInfo({ error: "API modelli non raggiungibile" });
    }
  };

  React.useEffect(() => {
    refresh();
  }, []);

  // Polling durante un download in corso
  React.useEffect(() => {
    if (info?.job?.status !== "in corso") return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [info?.job?.status]);

  const startDownload = async () => {
    if (!url.trim()) { setMsg("Inserisci l'URL del modello."); return; }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/models/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), expectedType: tipo })
      });
      const data = await res.json();
      if (!res.ok) setMsg(data.error || "Errore avvio download");
      else { setMsg(null); setUrl(""); }
      await refresh();
    } catch (e: any) {
      setMsg("Errore di rete: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const activate = async (file: string) => {
    if (!confirm(`Attivare "${file}" come orchestratore locale?\nIl servizio vf-brain verrà riavviato.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/models/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file })
      });
      const data = await res.json();
      setMsg(res.ok ? `Attivato: ${data.attivo}${data.restart ? "" : " — riavvia vf-brain manualmente"}` : (data.error || "Errore attivazione"));
      await refresh();
    } catch (e: any) {
      setMsg("Errore di rete: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const fileRow = (f: any, isOrch: boolean) => (
    <div key={f.name} className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
      <span className="font-mono text-[11px] text-slate-800 truncate">
        {f.name}
        <span className="text-slate-400 ml-2">{f.sizeMb} MB</span>
        {isOrch && info?.orchestratoreAttivo === f.name && (
          <span className="ml-2 text-emerald-700 font-bold">● attivo</span>
        )}
      </span>
      {isOrch && info?.orchestratoreAttivo !== f.name && (
        <button
          type="button"
          disabled={busy}
          onClick={() => activate(f.name)}
          className="shrink-0 px-2 py-1 rounded-md border border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-[10px] font-bold transition-colors disabled:opacity-50"
        >
          Attiva come orchestratore
        </button>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
        <Layers className="w-4 h-4 text-indigo-600" />
        <span>Modelli locali (orchestratore, visione, voci)</span>
        <button
          type="button"
          onClick={refresh}
          className="ml-auto px-2 py-1 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 text-[10px] font-bold normal-case tracking-normal transition-colors"
        >
          <RefreshCw className="w-3 h-3 inline mr-1" />Aggiorna
        </button>
      </h3>

      {/* Form download */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="md:col-span-2">
          <label className="block font-medium text-slate-700 mb-1">URL di download del modello</label>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://huggingface.co/.../file.gguf (Copy download link)"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-[11px]"
          />
        </div>
        <div>
          <label className="block font-medium text-slate-700 mb-1">Tipo di file atteso</label>
          <select
            value={tipo}
            onChange={e => setTipo(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            {MODEL_TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <button
          type="button"
          disabled={busy || info?.job?.status === "in corso"}
          onClick={startDownload}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-colors shadow-2xs disabled:opacity-50"
        >
          Scarica modello
        </button>
        {info?.job && (
          <span className={`font-mono text-[11px] ${info.job.status === "errore" ? "text-rose-700" : info.job.status === "completato" ? "text-emerald-700" : "text-slate-600"}`}>
            {info.job.status === "in corso" && "⏳ "}{info.job.file}: {info.job.status}
            {info.job.error ? ` — ${info.job.error}` : ""}
          </span>
        )}
        {msg && <span className="text-[11px] text-rose-700">{msg}</span>}
      </div>
      <p className="text-[10px] text-slate-500">
        Il tipo dichiarato viene verificato due volte: estensione dell'URL e firma del file
        (magic bytes) al primo blocco scaricato. Un file che non corrisponde viene scartato.
      </p>

      {/* Liste */}
      {info?.error && <p className="text-xs text-rose-700">{info.error}</p>}
      {info && !info.error && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2 border-t border-slate-100">
          <div className="space-y-1.5">
            <p className="font-bold text-slate-700">Orchestratore (/vf/models)</p>
            {(info.orchestratore || []).length === 0 && <p className="text-slate-400">Nessun GGUF presente.</p>}
            {(info.orchestratore || []).map((f: any) => fileRow(f, true))}
          </div>
          <div className="space-y-1.5">
            <p className="font-bold text-slate-700">Visione (/vf/vision/models)</p>
            {(info.visione || []).length === 0 && <p className="text-slate-400">Nessun peso presente.</p>}
            {(info.visione || []).map((f: any) => fileRow(f, false))}
          </div>
          <div className="space-y-1.5">
            <p className="font-bold text-slate-700">Voci (/vf/tts/voices)</p>
            {(info.voci || []).length === 0 && <p className="text-slate-400">Nessun campione presente.</p>}
            {(info.voci || []).map((f: any) => fileRow(f, false))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================
 * Dispositivi in rete & Kiosk
 * Scansiona la LAN dal server e distingue PC (possono fare da kiosk)
 * dalle telecamere IP (non hanno un browser: sono occhi, non schermi).
 * Il kiosk si installa aprendo /kiosk.bat DAL PC scelto: un download,
 * un doppio click, e il PC diventa postazione con avvio automatico.
 * ============================================================ */
const NetworkKioskCard: React.FC = () => {
  const [scan, setScan] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const doScan = async (cached: boolean) => {
    setBusy(!cached);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/network/scan${cached ? "?cached=1" : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore scansione");
      setScan(data.ultimo);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  React.useEffect(() => { doScan(true); }, []);

  const kioskUrl = `${window.location.origin}/kiosk.bat`;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-slate-800">Dispositivi in rete &amp; Kiosk</h3>
          <p className="text-xs text-slate-500">
            Trova gli apparecchi in LAN: i <b>PC</b> possono fare da kiosk, le <b>telecamere IP</b> no
            (niente browser: servono come occhi per la visione).
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => doScan(false)}
          className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-700 disabled:opacity-50 shrink-0"
        >
          {busy ? "Scansione… (~20 s)" : "Scansiona la rete"}
        </button>
      </div>

      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        <b>Per creare il kiosk:</b> dal PC scelto apri{" "}
        <a href="/kiosk.bat" className="underline font-mono">{kioskUrl}</a>{" "}
        e fai doppio click sul file scaricato. Il batch imposta l'avvio automatico e lancia subito il kiosk.
      </div>

      {err && <p className="text-sm text-rose-600">{err}</p>}

      {scan?.dispositivi?.length > 0 && (
        <div className="space-y-1.5 text-sm">
          <p className="text-xs text-slate-400">
            Rete {scan.rete} · server {scan.server} · scansione: {new Date(scan.quando).toLocaleString()}
          </p>
          {scan.dispositivi.map((d: any) => (
            <div
              key={d.ip}
              className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border ${
                d.puoKiosk ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="min-w-0">
                <span className="font-mono font-semibold">{d.ip}</span>
                <span className="text-slate-500"> · {d.tipo}</span>
                {d.vendor && !d.tipo.includes(d.vendor) && <span className="text-slate-400"> · {d.vendor}</span>}
                <span className="text-slate-300 text-xs"> · porte {d.porte.join(", ") || "—"}</span>
              </div>
              {d.puoKiosk && (
                <span className="text-emerald-700 text-xs font-semibold shrink-0">
                  può fare da kiosk → apri {kioskUrl} da qui
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {scan && (scan.dispositivi || []).length === 0 && (
        <p className="text-sm text-slate-400">Nessun dispositivo trovato (in dev su Windows la scansione è vuota: è normale).</p>
      )}
      {!scan && !busy && !err && (
        <p className="text-sm text-slate-400">Nessuna scansione ancora: premi «Scansiona la rete».</p>
      )}
    </div>
  );
};
