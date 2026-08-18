import React, { useState, useEffect } from "react";
import { 
  BookOpen, 
  Plus, 
  Search, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Network, 
  Database, 
  Languages, 
  HelpCircle,
  Volume2,
  RefreshCw,
  Send,
  Link2,
  BookmarkPlus
} from "lucide-react";
import { DialectToken, DialectCategory } from "../types";
import { triggerHapticFeedback } from "../utils/haptics";

interface Props {
  onLearnToken?: (token: Partial<DialectToken>) => void;
  onRefreshGraph?: () => void;
}

export const DialectActiveLearningStudio: React.FC<Props> = ({ onLearnToken, onRefreshGraph }) => {
  const [tokens, setTokens] = useState<DialectToken[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [notification, setNotification] = useState<string | null>(null);

  // Form state for new token / dialect insertion
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [newTerm, setNewTerm] = useState<string>("");
  const [newMeaning, setNewMeaning] = useState<string>("");
  const [newCategory, setNewCategory] = useState<DialectCategory>("DIALETTO_REGIONALE");
  const [newPhonetic, setNewPhonetic] = useState<string>("");
  const [newSlaveSource, setNewSlaveSource] = useState<string>("Smartphone Operatore (Wi-Fi)");
  const [newForeignEq, setNewForeignEq] = useState<string>("");
  const [newEtymology, setNewEtymology] = useState<string>("");

  // Quick live test simulation
  const [testPhrase, setTestPhrase] = useState<string>("Bada lì al display del terminale slave e metti tutto in nàna");
  const [testResult, setTestResult] = useState<string | null>(null);

  const fetchDialects = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/dialects");
      const data = await res.json();
      if (data && Array.isArray(data.tokens)) {
        setTokens(data.tokens);
      }
    } catch (e) {
      console.warn("Failed to fetch dialects from backend:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDialects();
  }, []);

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerm.trim()) return;

    try {
      const foreigns = newForeignEq
        ? newForeignEq.split(",").map(s => s.trim()).filter(Boolean)
        : [];

      const res = await fetch("/api/dialects/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term: newTerm.trim(),
          standardMeaning: newMeaning.trim(),
          category: newCategory,
          phoneticAlt: newPhonetic.trim() || newTerm.toLowerCase(),
          sourceSlaveName: newSlaveSource,
          foreignEquivalents: foreigns,
          inventedEtymology: newEtymology.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        setNotification(`Termine '${data.token.term}' catalogato con successo in DB e Grafo!`);
        setTimeout(() => setNotification(null), 4000);
        triggerHapticFeedback("CONFIRMATION_PULSE", 0.7, 120);
        setNewTerm("");
        setNewMeaning("");
        setNewPhonetic("");
        setNewForeignEq("");
        setNewEtymology("");
        setIsAddingNew(false);
        fetchDialects();
        if (onRefreshGraph) onRefreshGraph();
      }
    } catch (err: any) {
      alert("Errore nell'aggiunta del termine: " + err.message);
    }
  };

  const handleTestDisambiguation = () => {
    if (!testPhrase.trim()) return;
    const lower = testPhrase.toLowerCase();
    const matched = tokens.filter(t => lower.includes(t.term.toLowerCase()));

    if (matched.length > 0) {
      setTestResult(
        `Riconosciuti ${matched.length} termini attivi nel grafo: ` +
        matched.map(m => `«${m.term}» (${m.category} → ${m.standardMeaning})`).join(" • ")
      );
    } else {
      setTestResult(
        `Nessun termine registrato rilevato. Il Master proporrebbe l'Addestramento Attivo per disambiguare le parole sconosciute.`
      );
    }
  };

  const filteredTokens = tokens.filter(t => {
    const matchesSearch = 
      t.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.standardMeaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.phoneticAlt.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === "ALL" || t.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const getCategoryBadgeClass = (cat: DialectCategory) => {
    switch (cat) {
      case "DIALETTO_REGIONALE":
        return "bg-amber-50 text-amber-800 border-amber-300";
      case "PAROLA_INVENTATA":
        return "bg-purple-50 text-purple-800 border-purple-300";
      case "VOCALIZZO_VERSO":
        return "bg-rose-50 text-rose-800 border-rose-300";
      case "GERGO_OPERATIVO":
        return "bg-blue-50 text-blue-800 border-blue-300";
      case "TERMINE_ESTERO":
        return "bg-emerald-50 text-emerald-800 border-emerald-300";
      default:
        return "bg-slate-50 text-slate-800 border-slate-300";
    }
  };

  return (
    <div id="dialect-learning-studio" className="space-y-6">
      {/* Header card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Addestramento Attivo Dialetti & Neologismi
              </h2>
              <p className="text-xs text-slate-500">
                Doppia catalogazione su Database Relazionale SQL e Grafo di Conoscenza Semantico.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchDialects()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Ricarica Database</span>
          </button>

          <button
            onClick={() => setIsAddingNew(!isAddingNew)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Nuovo Termine Dialettale</span>
          </button>
        </div>
      </div>

      {notification && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* New Dialect Form Drawer/Section */}
      {isAddingNew && (
        <form onSubmit={handleCreateToken} className="bg-white rounded-xl border border-indigo-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
              <BookmarkPlus className="w-4 h-4 text-indigo-600" />
              <span>Registra Nuova Parola o Verso Riconosciuto da Slave Wi-Fi</span>
            </div>
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Annulla
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Termine / Verso / Parola *
              </label>
              <input
                type="text"
                value={newTerm}
                onChange={e => setNewTerm(e.target.value)}
                placeholder="es. Bada, Nàna, Gnamo, Zzz-click..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Categoria Classificazione *
              </label>
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
              >
                <option value="DIALETTO_REGIONALE">Dialetto Regionale (Toscano, Romano, etc.)</option>
                <option value="PAROLA_INVENTATA">Parola Inventata dall'Operatore</option>
                <option value="VOCALIZZO_VERSO">Vocalizzo / Verso Onomatopeico</option>
                <option value="GERGO_OPERATIVO">Gergo Operativo & Mesh</option>
                <option value="TERMINE_ESTERO">Termine Estero / Slang</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Significato Standard Italiano *
              </label>
              <input
                type="text"
                value={newMeaning}
                onChange={e => setNewMeaning(e.target.value)}
                placeholder="es. Fai attenzione / Metti in standby..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Pronuncia Fonetica / Trascrizione
              </label>
              <input
                type="text"
                value={newPhonetic}
                onChange={e => setNewPhonetic(e.target.value)}
                placeholder="es. ba-da, naa-na..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Terminale Slave di Origine
              </label>
              <select
                value={newSlaveSource}
                onChange={e => setNewSlaveSource(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
              >
                <option value="Smartphone Operatore (Wi-Fi)">Smartphone Operatore (Wi-Fi 5.8GHz)</option>
                <option value="Smartwatch Slave (BLE-Mesh)">Smartwatch Slave (BLE-Mesh)</option>
                <option value="Terminale Fisso Master">Terminale Fisso Master</option>
                <option value="Array Microfonico Ambientale">Array Microfonico Ambientale</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Equivalenti Stranieri (opzionale)
              </label>
              <input
                type="text"
                value={newForeignEq}
                onChange={e => setNewForeignEq(e.target.value)}
                placeholder="es. Watch out (EN), Attention (FR)"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block font-medium text-slate-700 mb-1">
                Etimologia o Contesto d'Uso della Parola Inventata
              </label>
              <input
                type="text"
                value={newEtymology}
                onChange={e => setNewEtymology(e.target.value)}
                placeholder="es. Coniata durante sessione notturna per indicare la disattivazione silente dei beacon radio..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
            >
              Registra su Database & Grafo Semantico
            </button>
          </div>
        </form>
      )}

      {/* Simulator Test Sandbox */}
      <div className="bg-slate-100/70 rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            Test di Disambiguazione & Riconoscimento Istantaneo dal Vivo
          </h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={testPhrase}
            onChange={e => setTestPhrase(e.target.value)}
            placeholder="Scrivi una frase contenente dialetto o parole inventate..."
            className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={handleTestDisambiguation}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors shrink-0"
          >
            Verifica Grafo
          </button>
        </div>
        {testResult && (
          <div className="mt-2 p-2.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700">
            {testResult}
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cerca termine, significato, fonetica..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap gap-1 w-full sm:w-auto">
          {[
            { id: "ALL", label: "Tutti i Termini" },
            { id: "DIALETTO_REGIONALE", label: "Dialetti" },
            { id: "PAROLA_INVENTATA", label: "Parole Inventate" },
            { id: "VOCALIZZO_VERSO", label: "Versi & Suoni" },
            { id: "GERGO_OPERATIVO", label: "Gergo Mesh" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                selectedCategory === tab.id
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Double-Cataloged Database Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Registro Database Dialetti ({filteredTokens.length} Voci)
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Sincronizzazione Duplex Master ↔ Grafo Attiva
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Termine / Verso</th>
                <th className="py-2.5 px-4">Categoria</th>
                <th className="py-2.5 px-4">Significato Standard</th>
                <th className="py-2.5 px-4">Fonetica</th>
                <th className="py-2.5 px-4">Sorgente Slave</th>
                <th className="py-2.5 px-4">Doppia Catalogazione</th>
                <th className="py-2.5 px-4 text-right">Occorrenze</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTokens.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Nessun termine corrispondente ai criteri di ricerca.
                  </td>
                </tr>
              ) : (
                filteredTokens.map(token => (
                  <tr key={token.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 text-sm">{token.term}</div>
                      {token.inventedEtymology && (
                        <div className="text-[10px] text-slate-500 italic max-w-xs truncate">
                          «{token.inventedEtymology}»
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getCategoryBadgeClass(token.category)}`}>
                        {token.category.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{token.standardMeaning}</div>
                      {token.foreignEquivalents && token.foreignEquivalents.length > 0 && (
                        <div className="text-[10px] text-indigo-600 mt-0.5">
                          Trad: {token.foreignEquivalents.join(", ")}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      /{token.phoneticAlt}/
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {token.sourceSlaveName}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Database className="w-3 h-3" /> DB
                        </span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Network className="w-3 h-3" /> Grafo
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                      {token.occurrenceCount}x
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
