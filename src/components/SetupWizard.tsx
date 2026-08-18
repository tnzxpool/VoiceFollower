import React, { useState } from "react";
import {
  Wand2,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  Server,
  Cpu,
  Bot,
  PlayCircle,
  Save
} from "lucide-react";
import { AdminConfig } from "../types";

interface Props {
  formData: AdminConfig;
  setFormData: (c: AdminConfig) => void;
  onSave: () => Promise<void> | void;
  onClose: () => void;
}

type StepState = "idle" | "running" | "ok" | "fail";

interface StepResult {
  state: StepState;
  message: string;
  remedy?: string;
  extra?: any;
}

const initial: StepResult = { state: "idle", message: "" };

/**
 * Procedura guidata Admin: verifica il sistema passo per passo, con esito
 * verde/rosso e — per ogni errore — il rimedio concreto da applicare.
 * Pensata per preparare il sistema e correggere gli errori senza conoscerlo.
 */
export const SetupWizard: React.FC<Props> = ({ formData, setFormData, onSave, onClose }) => {
  const [step, setStep] = useState(0);
  const [results, setResults] = useState<StepResult[]>([initial, initial, initial, initial]);

  const setResult = (i: number, r: StepResult) =>
    setResults(prev => prev.map((p, idx) => (idx === i ? r : p)));

  // ---- Passo 1: server master ----
  const checkServer = async () => {
    setResult(0, { state: "running", message: "Interrogo il server master..." });
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setResult(0, {
        state: "ok",
        message: `Server master attivo: ${data.system || "ok"} (${data.nodeCount ?? "?"} nodi nel grafo)`
      });
    } catch {
      setResult(0, {
        state: "fail",
        message: "Il server master non risponde su /api/health.",
        remedy: "Sul computer che ospita l'app esegui: npm run dev (oppure NODE_ENV=production npx tsx server.ts). Verifica che la porta 3000 non sia occupata."
      });
    }
  };

  // ---- Passo 2: motore LLM ----
  const checkLlm = async () => {
    setResult(1, { state: "running", message: "Verifico il motore LLM configurato..." });
    try {
      const res = await fetch("/api/ollama/models");
      const data = await res.json();
      if (!data.reachable) {
        setResult(1, {
          state: "fail",
          message: data.error || "Endpoint LLM non raggiungibile.",
          remedy: "Controlla il campo 'Endpoint LLM Locale' qui sotto. Per il cervello locale sul CT: http://127.0.0.1:9101/v1 senza credenziali. Per un portale LLM esterno: https://tuo-dominio:porta con username e password. Poi ripeti la verifica."
        });
        return;
      }
      const modeLabel: Record<string, string> = {
        ollama: "Ollama nativo",
        r740_factory: "R740 AI Factory",
        r740_portal: "Portale R740 live"
      };
      const needCreds = data.mode === "r740_portal" && (data.models || []).length === 0;
      setResult(1, {
        state: needCreds ? "fail" : "ok",
        message: `Motore raggiunto: ${modeLabel[data.mode] || data.mode} — ${(data.models || []).length} modelli. ${data.activeModelInstalled ? `Modello attivo "${data.activeModel}" presente.` : `ATTENZIONE: il modello "${data.activeModel}" NON risulta tra quelli disponibili.`}`,
        remedy: needCreds
          ? "Il portale risponde ma mancano le credenziali: inserisci Username e Password del portale nei campi qui sotto, salva e ripeti."
          : !data.activeModelInstalled
            ? "Clicca uno dei modelli elencati per selezionarlo come modello attivo."
            : undefined,
        extra: data.models
      });
    } catch {
      setResult(1, {
        state: "fail",
        message: "Errore di rete verso il server master.",
        remedy: "Completa prima il Passo 1."
      });
    }
  };

  // ---- Passo 3: provider primario (solo scelta guidata, nessuna chiamata) ----
  const checkProvider = () => {
    const p = formData.primaryProvider;
    const missingKey =
      (p === "gemini" && !formData.geminiApiKey) ||
      (p === "deepseek" && !formData.deepseekApiKey) ||
      (p === "glm" && !formData.glmApiKey) ||
      (p === "claude" && !formData.anthropicApiKey);
    if (missingKey) {
      setResult(2, {
        state: "fail",
        message: `Provider "${p}" selezionato ma la sua chiave API è vuota.`,
        remedy: "Inserisci la chiave nel riquadro 'Chiavi API' del pannello, salva la configurazione e ripeti questo passo. In alternativa scegli 'LLM Locale / Portale R740' che non richiede chiavi esterne."
      });
    } else {
      setResult(2, {
        state: "ok",
        message: `Provider primario "${p}" pronto${p === "local_ollama" ? " (motore locale/portale verificato al Passo 2)" : ", chiave presente"}.`
      });
    }
  };

  // ---- Passo 4: test di orchestrazione reale ----
  const runRealTest = async () => {
    setResult(3, { state: "running", message: "Domanda di prova al provider selezionato (può richiedere fino a 90s)..." });
    try {
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Presentati in una frase breve e calma.",
          providerOverride: formData.primaryProvider,
          useHighThinking: false
        })
      });
      const data = await res.json();
      if (data.providerFailureNotice) {
        setResult(3, {
          state: "fail",
          message: `Il provider ha fallito ed è intervenuto il fallback [${data.modelUsed}]. Dettaglio: ${data.providerFailureNotice}`,
          remedy: "Leggi il dettaglio: se parla di credenziali torna al Passo 2/3; se parla di timeout il modello sta caricando o l'endpoint è lento — riprova tra un minuto."
        });
      } else {
        setResult(3, {
          state: "ok",
          message: `[${data.modelUsed}] ha risposto: "${data.spokenResponse}" (${data.latencyMs}ms)`
        });
      }
    } catch (err: any) {
      setResult(3, {
        state: "fail",
        message: "Errore di rete durante il test: " + (err?.message || err),
        remedy: "Completa prima il Passo 1 (server master attivo)."
      });
    }
  };

  const steps = [
    { title: "Server Master", icon: Server, run: checkServer, desc: "Il cuore dell'app risponde?" },
    { title: "Motore LLM", icon: Cpu, run: checkLlm, desc: "Endpoint e modelli reali raggiungibili?" },
    { title: "Provider primario", icon: Bot, run: checkProvider, desc: "La scelta ha tutto ciò che le serve?" },
    { title: "Prova reale", icon: PlayCircle, run: runRealTest, desc: "Una domanda vera, una risposta vera." }
  ];

  const allOk = results.every(r => r.state === "ok");

  return (
    <div className="bg-white rounded-xl border-2 border-indigo-200 p-5 shadow-md space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-indigo-600" />
          Procedura guidata — preparazione e correzione errori
        </h3>
        <button type="button" onClick={onClose} className="text-xs text-slate-500 hover:text-slate-800">
          Chiudi ✕
        </button>
      </div>

      <ol className="space-y-3">
        {steps.map((s, i) => {
          const r = results[i];
          const Icon = s.icon;
          return (
            <li key={s.title} className={`rounded-lg border p-3 ${i === step ? "border-indigo-300 bg-indigo-50/40" : "border-slate-200"}`}>
              <div className="flex items-center gap-2 text-xs">
                {r.state === "ok" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : r.state === "fail" ? (
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                ) : r.state === "running" ? (
                  <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                ) : (
                  <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <span className="font-semibold text-slate-800">{i + 1}. {s.title}</span>
                <span className="text-slate-500">— {s.desc}</span>
                <button
                  type="button"
                  onClick={() => { setStep(i); s.run(); }}
                  className="ml-auto px-2.5 py-1 rounded-md bg-indigo-600 text-white text-[11px] font-bold hover:bg-indigo-700"
                >
                  {r.state === "idle" ? "Verifica" : "Ripeti"}
                </button>
              </div>
              {r.message && (
                <p className={`mt-2 text-[11px] font-mono ${r.state === "fail" ? "text-rose-700" : "text-slate-700"}`}>{r.message}</p>
              )}
              {r.remedy && r.state === "fail" && (
                <p className="mt-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2">
                  <strong>Rimedio:</strong> {r.remedy}
                </p>
              )}
              {i === 1 && Array.isArray(r.extra) && r.extra.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.extra.map((m: any) => (
                    <button
                      key={m.name}
                      type="button"
                      onClick={() => setFormData({ ...formData, localLlmModel: m.name })}
                      className={`px-2 py-1 rounded-md border text-[10px] font-mono ${formData.localLlmModel === m.name ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-300 hover:border-indigo-400"}`}
                    >
                      {m.name}{m.family ? ` · ${m.family}` : ""}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => onSave()}
          disabled={!allOk}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-40 hover:bg-emerald-700"
        >
          <Save className="w-4 h-4" /> Tutto verde — salva la configurazione
        </button>
        {!allOk && (
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <ChevronRight className="w-3 h-3" /> Esegui i 4 passi in ordine: il salvataggio si abilita quando sono tutti verdi.
          </span>
        )}
      </div>
    </div>
  );
};
