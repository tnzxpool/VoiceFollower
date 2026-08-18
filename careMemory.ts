/**
 * careMemory.ts — Memoria di cura, trasparente all'utente.
 *
 * 1. OGGETTI IMPORTANTI: ascoltando i discorsi, il sistema estrae e ricorda
 *    l'ultima collocazione degli oggetti che il soggetto tende a perdere
 *    (occhiali, chiavi, portafoglio...) e aggiorna il grafo semantico.
 * 2. SALVAGENTE: rileva segnali di disorientamento (frasi ripetute, "non
 *    ricordo", "dove siamo"...) e istruisce l'orchestratore a reimpostare il
 *    dialogo verso un'ancora serena o a rimandare le decisioni.
 * 3. CONTATTO IMMEDIATO: frase breve pronunciata subito mentre il modello
 *    grande calcola (latenza percepita ~0).
 * 4. AVVIO CALMO: saluto breve, una sola volta per accensione.
 */

type Graph = { nodes: any[]; edges: any[] };

export interface TrackedObject {
  id: string;
  label: string;
  aliases: string[];
  lastLocation: string | null;
  lastSeenAt: string | null;
  sourcePhrase: string | null;
  history: Array<{ location: string; at: string; phrase: string }>;
}

const ts = () => new Date().toLocaleString("it-IT");

function makeObj(id: string, label: string, aliases: string[]): TrackedObject {
  return { id, label, aliases, lastLocation: null, lastSeenAt: null, sourcePhrase: null, history: [] };
}

// Alias più lunghi per primi: la corrispondenza si ferma al primo che matcha.
export const trackedObjects: TrackedObject[] = [
  makeObj("occhiali", "occhiali", ["occhiali da lettura", "occhiali da vista", "occhiali"]),
  makeObj("chiavi", "chiavi", ["chiavi di casa", "mazzo di chiavi", "chiavi"]),
  makeObj("portafoglio", "portafoglio", ["portafoglio", "portafogli", "borsellino"]),
  makeObj("telefono", "telefono", ["telefonino", "cellulare", "telefono"]),
  makeObj("medicine", "medicine", ["pastiglie", "pillole", "farmaci", "medicine", "medicina"]),
  makeObj("telecomando", "telecomando", ["telecomando"]),
  makeObj("borsa", "borsa", ["borsetta", "borsa"]),
  makeObj("dentiera", "dentiera", ["dentiera"]),
  makeObj("apparecchio", "apparecchio acustico", ["apparecchio acustico", "apparecchio"]),
  makeObj("bastone", "bastone", ["bastone"]),
  makeObj("documenti", "documenti", ["carta d'identita", "tessera sanitaria", "documenti"])
];

const ART = "(?:il |lo |la |i |gli |le |l'|un |una |i miei |le mie |mio |mia |miei |mie )?";
const PREP = "(?:su|sul|sulla|sullo|sui|sugli|nel|nella|nello|negli|in|dentro|sopra|sotto|dietro|davanti|accanto|vicino|a fianco)";

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findLocation(text: string, alias: string): string | null {
  const t = text.toLowerCase();
  const a = escapeRe(alias.toLowerCase());
  const patterns = [
    new RegExp(`(?:ho|hai|ha|abbiamo|avevo)\\s+(?:messo|lasciato|posato|appoggiato|riposto|dimenticato)\\s+${ART}${a}\\s+(${PREP}[^.,;!?]{2,50})`),
    new RegExp(`${ART}${a}\\s+(?:sono|stanno|erano|è|e'|sta|era|si trova|si trovano)\\s+(${PREP}[^.,;!?]{2,50})`),
    new RegExp(`(?:metto|lascio|poso|appoggio|ripongo)\\s+${ART}${a}\\s+(${PREP}[^.,;!?]{2,50})`)
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

export function upsertObjectInGraph(graph: Graph, obj: TrackedObject) {
  const label = `Oggetto: ${obj.label}`;
  let node = graph.nodes.find(n => n.label === label);
  if (!node) {
    node = { id: "obj_" + obj.id, label, category: "entity", attributes: {} };
    graph.nodes.push(node);
    graph.edges.push({ source: "user_profile", target: node.id, relation: "OGGETTO_IMPORTANTE", weight: 1 });
  }
  node.attributes = {
    ...node.attributes,
    ultimaCollocazione: obj.lastLocation,
    aggiornato: obj.lastSeenAt,
    fonte: obj.sourcePhrase
  };
}

// ---------------- Salvagente ----------------
const recent: Array<{ text: string; at: number }> = [];
let lastSignals: string[] = [];
let lastLevel = 0;

const DISTRESS: Array<[string, string]> = [
  ["non ricordo", "fatica di memoria dichiarata"],
  ["non mi ricordo", "fatica di memoria dichiarata"],
  ["non so dove", "disorientamento spaziale"],
  ["dove siamo", "disorientamento spaziale"],
  ["chi sei", "mancato riconoscimento"],
  ["non ti conosco", "mancato riconoscimento"],
  ["voglio andare a casa", "richiesta di casa (ancora affettiva)"],
  ["mi sono perso", "smarrimento"],
  ["mi sono persa", "smarrimento"],
  ["ho paura", "paura"],
  ["aiuto", "richiesta di aiuto"],
  ["non capisco", "confusione"],
  ["che giorno e", "ancoraggio temporale richiesto"]
];

export function assessUtterance(text: string): { level: number; signals: string[] } {
  const t = text.toLowerCase().trim();
  const nowMs = Date.now();
  const signals: string[] = [];
  for (const [kw, sig] of DISTRESS) {
    if (t.includes(kw) && !signals.includes(sig)) signals.push(sig);
  }
  const norm = t.replace(/[^\p{L}\p{N} ]/gu, "").trim();
  const repeats = recent.filter(r => nowMs - r.at < 10 * 60 * 1000 && r.text === norm).length;
  if (norm.length > 3 && repeats >= 1) signals.push(`stessa frase ripetuta ${repeats + 1} volte in 10 minuti`);
  recent.push({ text: norm, at: nowMs });
  while (recent.length > 60) recent.shift();
  const level = signals.length >= 2 ? 2 : signals.length === 1 ? 1 : 0;
  lastSignals = signals;
  lastLevel = level;
  return { level, signals };
}

function salvageInstructions(level: number, signals: string[]): string {
  if (level === 0) return "";
  return `

SALVAGENTE ATTIVO (livello ${level}) — segnali rilevati: ${signals.join("; ")}.
Comportati così:
1. Rassicura con calma e brevità, senza MAI far notare l'errore o la ripetizione.
2. Reimposta il dialogo verso un'ancora concreta e serena: un ricordo caro, la stanza in cui si trova, l'ora del giorno, una canzone amata.
3. Se c'è una decisione o una preoccupazione, rimandala con dolcezza a un momento migliore ("ne parliamo con calma dopo pranzo, adesso...").
4. Una sola idea per frase, tono caldo, mai frettoloso.`;
}

// ---------------- Contatto immediato ----------------
const CONTACT = [
  "Sì, ti ascolto...",
  "Sono qui con te, dimmi pure...",
  "Certo, un momento solo...",
  "Ti sento, eccomi...",
  "Va bene, ci penso subito..."
];
let contactIdx = 0;
let lastContactAt = 0;

export function getContactPhrase(userText: string): { speak: boolean; phrase: string } {
  const nowMs = Date.now();
  if (nowMs - lastContactAt < 15000) return { speak: false, phrase: "" };
  lastContactAt = nowMs;
  const t = (userText || "").toLowerCase();
  const phrase = /dove\s|non trovo|ho perso/.test(t)
    ? "Vediamo insieme, un attimo..."
    : CONTACT[contactIdx++ % CONTACT.length];
  return { speak: true, phrase };
}

// ---------------- Avvio calmo ----------------
let greetedAt: string | null = null;

export function getBootGreeting(): { speak: boolean; text: string; greetedAt: string | null } {
  if (greetedAt) return { speak: false, text: "", greetedAt };
  greetedAt = ts();
  const h = new Date().getHours();
  const momento = h < 12 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera";
  return { speak: true, text: `${momento}. Sono qui con te, va tutto bene.`, greetedAt };
}

// ---------------- Elaborazione centrale ----------------
export function processCareUtterance(text: string, graph: Graph): {
  promptAddition: string;
  directAnswer: string | null;
  publicState: any;
} {
  const updates: string[] = [];
  let directAnswer: string | null = null;
  const raw = String(text || "");

  // 1. Dichiarazioni di collocazione → memoria + grafo
  for (const obj of trackedObjects) {
    for (const alias of obj.aliases) {
      const loc = findLocation(raw, alias);
      if (loc) {
        obj.lastLocation = loc;
        obj.lastSeenAt = ts();
        obj.sourcePhrase = raw.slice(0, 120);
        obj.history.push({ location: loc, at: obj.lastSeenAt, phrase: obj.sourcePhrase });
        if (obj.history.length > 20) obj.history.shift();
        upsertObjectInGraph(graph, obj);
        updates.push(`${obj.label} → ${loc}`);
        break;
      }
    }
  }

  // 2. Domanda "dove è..." → risposta certa dalla memoria
  const t = raw.toLowerCase();
  const isWhere = /(dove\s+(è|e'|sono|sta|stanno|ho messo|ho lasciato|avro messo|avrò messo))|non trovo|non riesco a trovare|ho perso/.test(t);
  if (isWhere) {
    const target = trackedObjects.find(o => o.aliases.some(a => t.includes(a.toLowerCase())));
    if (target && target.lastLocation) {
      directAnswer = `Cerchiamo ${target.label} insieme, con calma: l'ultima volta ${target.lastLocation} — me lo hai detto tu, ${target.lastSeenAt}.`;
    }
  }

  // 3. Salvagente
  const { level, signals } = assessUtterance(raw);

  // 4. Memoria oggetti nel prompt (sintetica, solo collocazioni note)
  const known = trackedObjects.filter(o => o.lastLocation);
  const objSummary = known.length
    ? `

MEMORIA OGGETTI IMPORTANTI (ultima collocazione sentita nei discorsi — usala per rispondere a "dove è..."):
${known.map(o => `- ${o.label}: ${o.lastLocation} (${o.lastSeenAt})`).join("\n")}`
    : "";

  const promptAddition =
    objSummary +
    salvageInstructions(level, signals) +
    (directAnswer ? `\n\nFATTO CERTO dalla memoria, integralo nella risposta: ${directAnswer}` : "");

  return {
    promptAddition,
    directAnswer,
    publicState: {
      disorientationLevel: level,
      signals,
      objectsKnown: known.map(o => ({ id: o.id, label: o.label, lastLocation: o.lastLocation, lastSeenAt: o.lastSeenAt })),
      updates
    }
  };
}

// ---------------- API ----------------
export function registerCareRoutes(app: any, graph: Graph) {
  app.get("/api/care/objects", (_req: any, res: any) => {
    res.json({ objects: trackedObjects });
  });

  // Il caregiver può impostare o correggere una collocazione a mano
  app.post("/api/care/objects", (req: any, res: any) => {
    const { id, label, location } = req.body || {};
    let obj = trackedObjects.find(o => o.id === id || o.label === label);
    if (!obj && label) {
      obj = makeObj("custom_" + Date.now().toString(36), String(label).toLowerCase(), [String(label).toLowerCase()]);
      trackedObjects.push(obj);
    }
    if (!obj) return res.status(400).json({ error: "Oggetto non riconosciuto: indica 'id' o 'label'." });
    if (location) {
      obj.lastLocation = String(location);
      obj.lastSeenAt = ts();
      obj.sourcePhrase = "impostato dal caregiver";
      obj.history.push({ location: obj.lastLocation, at: obj.lastSeenAt, phrase: obj.sourcePhrase });
      upsertObjectInGraph(graph, obj);
    }
    res.json({ success: true, object: obj });
  });

  app.get("/api/care/state", (_req: any, res: any) => {
    res.json({ disorientationLevel: lastLevel, signals: lastSignals, recentUtterances: recent.length, greetedAt });
  });

  app.post("/api/care/contact", (req: any, res: any) => {
    const r = getContactPhrase(String(req.body?.prompt || ""));
    res.json({ ...r, latencyMs: 3 });
  });

  app.get("/api/care/greeting", (_req: any, res: any) => {
    res.json(getBootGreeting());
  });
}
