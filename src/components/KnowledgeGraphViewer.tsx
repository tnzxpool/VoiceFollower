import React, { useState, useEffect, useRef } from "react";
import * as d3 from "d3";
import {
  Share2,
  Database,
  Search,
  Plus,
  BookOpen,
  Layers,
  Sparkles,
  Link as LinkIcon,
  Tag,
  ShieldCheck,
  Check
} from "lucide-react";
import { KnowledgeGraphNode, KnowledgeGraphEdge, RAGDocument } from "../types";
import { triggerHapticFeedback } from "../utils/haptics";

interface KnowledgeGraphViewerProps {
  graphData: { nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] };
  ragDocs: RAGDocument[];
  onAddGraphNode: (label: string, category: any, relationTo: string) => void;
}

export const KnowledgeGraphViewer: React.FC<KnowledgeGraphViewerProps> = ({
  graphData,
  ragDocs,
  onAddGraphNode
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"graph" | "rag">("graph");
  const [selectedNode, setSelectedNode] = useState<KnowledgeGraphNode | null>(null);
  const [ragQuery, setRagQuery] = useState("");
  const [ragMatches, setRagMatches] = useState<RAGDocument[]>(ragDocs);
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [newNodeCategory, setNewNodeCategory] = useState<"memory" | "peripheral" | "task" | "policy">("memory");

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Render D3 Force-directed Knowledge Graph
  useEffect(() => {
    if (activeSubTab !== "graph" || !svgRef.current) return;

    const width = svgRef.current.clientWidth || 600;
    const height = 400;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");

    // Zoom and pan
    const zoom = d3.zoom<SVGSVGElement, unknown>().on("zoom", (event) => {
      g.attr("transform", event.transform);
    });
    svg.call(zoom as any);

    // Deep clone data for D3 mutation
    const nodes: any[] = graphData.nodes.map(d => ({ ...d }));
    const links: any[] = graphData.edges.map(d => ({ ...d }));

    const colorMap: Record<string, string> = {
      entity: "#4f46e5",
      peripheral: "#a855f7",
      memory: "#10b981",
      task: "#f59e0b",
      policy: "#ef4444"
    };

    // Simulation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(90))
      .force("charge", d3.forceManyBody().strength(-280))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(35));

    // Draw Links
    const link = g.append("g")
      .attr("stroke", "#cbd5e1")
      .attr("stroke-opacity", 0.9)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d: any) => Math.max(1.5, d.weight * 2.5));

    // Link Labels
    const linkLabels = g.append("g")
      .selectAll("text")
      .data(links)
      .join("text")
      .attr("font-size", "9px")
      .attr("font-family", "monospace")
      .attr("fill", "#64748b")
      .attr("text-anchor", "middle")
      .text((d: any) => d.relation);

    // Draw Nodes
    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(
        d3.drag<any, any>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      )
      .on("click", (event, d) => {
        setSelectedNode(d);
        triggerHapticFeedback("CONFIRMATION_PULSE", 0.5, 80);
      });

    // Node Circle
    node.append("circle")
      .attr("r", 18)
      .attr("fill", "#ffffff")
      .attr("stroke", (d: any) => colorMap[d.category] || "#4f46e5")
      .attr("stroke-width", 2.5)
      .attr("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.08))");

    // Node inner icon/bullet
    node.append("circle")
      .attr("r", 6)
      .attr("fill", (d: any) => colorMap[d.category] || "#4f46e5");

    // Node Text Label
    node.append("text")
      .attr("dy", 32)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("fill", "#1e293b")
      .text((d: any) => d.label);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      linkLabels
        .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
        .attr("y", (d: any) => (d.source.y + d.target.y) / 2);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [graphData, activeSubTab]);

  const handleRagSearch = (query: string) => {
    setRagQuery(query);
    if (!query.trim()) {
      setRagMatches(ragDocs);
      return;
    }
    const q = query.toLowerCase();
    const filtered = ragDocs.filter(
      d =>
        d.title.toLowerCase().includes(q) ||
        d.content.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
    );
    setRagMatches(filtered);
  };

  const handleAddNodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeLabel.trim()) return;
    onAddGraphNode(newNodeLabel.trim(), newNodeCategory, "OSSERVAZIONE_DINAMICA");
    setNewNodeLabel("");
    triggerHapticFeedback("CONFIRMATION_PULSE", 0.7, 120);
  };

  return (
    <div id="knowledge-graph-rag-view" className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Main Graph & RAG Tabs (8 cols) */}
      <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-5 flex flex-col shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-indigo-600" />
              <span>Grafo di Conoscenza Contestuale & RAG Vettoriale</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Doppia catalogazione: relazioni di grafo e documentazione tecnica incorporata
            </p>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveSubTab("graph")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeSubTab === "graph"
                  ? "bg-white text-indigo-700 shadow-2xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Grafo Interattivo</span>
            </button>
            <button
              onClick={() => setActiveSubTab("rag")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeSubTab === "rag"
                  ? "bg-white text-indigo-700 shadow-2xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Documenti RAG</span>
            </button>
          </div>
        </div>

        {activeSubTab === "graph" ? (
          <div className="flex-1 flex flex-col">
            <div className="w-full h-[380px] bg-slate-50 rounded-xl border border-slate-200 overflow-hidden relative">
              <svg ref={svgRef} className="w-full h-full" />
              <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-200 text-[10px] text-slate-600 font-mono shadow-2xs">
                Trascina i nodi • Clicca per ispezionare le relazioni
              </div>
            </div>

            {/* Category Color Legend */}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                Entità Principale
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                Unità Periferica
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Memoria / Dialetto
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Piano Operativo
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                Regola di Sicurezza
              </span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={ragQuery}
                onChange={(e) => handleRagSearch(e.target.value)}
                placeholder="Cerca nel database vettoriale RAG (es. protocollo, aptica, INT4)..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[340px] pr-1">
              {ragMatches.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-900">{doc.title}</span>
                    <span className="text-[10px] font-mono font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {doc.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{doc.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Node Details & Dynamic Entity Generator (4 cols) */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        {/* Selected Node Details */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-3">
            <Tag className="w-3.5 h-3.5 text-indigo-600" />
            <span>Ispettore Entità Grafo</span>
          </h3>

          {selectedNode ? (
            <div className="space-y-2 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 text-[10px] block font-mono uppercase">Etichetta Nodo</span>
                <span className="font-bold text-slate-900">{selectedNode.label}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 text-[10px] block font-mono uppercase">Categoria</span>
                <span className="font-mono text-indigo-700 font-semibold capitalize">{selectedNode.category}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 text-[10px] block font-mono uppercase">Attributi</span>
                <pre className="text-[11px] font-mono text-slate-700 mt-1 whitespace-pre-wrap">
                  {JSON.stringify(selectedNode.attributes || {}, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 p-4 text-center">
              Clicca su un nodo nel grafo per ispezionare le connessioni e i metadati.
            </p>
          )}
        </div>

        {/* Add Context Node Form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-3">
            <Plus className="w-3.5 h-3.5 text-indigo-600" />
            <span>Aggiungi Nodo al Grafo</span>
          </h3>

          <form onSubmit={handleAddNodeSubmit} className="space-y-2.5 text-xs">
            <div>
              <label className="text-slate-700 font-medium text-[11px] block mb-1">Nome / Etichetta Entità</label>
              <input
                type="text"
                value={newNodeLabel}
                onChange={(e) => setNewNodeLabel(e.target.value)}
                placeholder="es. Coordinata Spaziale X-4"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-slate-700 font-medium text-[11px] block mb-1">Categoria</label>
              <select
                value={newNodeCategory}
                onChange={(e) => setNewNodeCategory(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="memory">Memoria / Contesto</option>
                <option value="peripheral">Unità Periferica</option>
                <option value="task">Piano Operativo</option>
                <option value="policy">Regola di Sicurezza</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-all shadow-xs"
            >
              Registra nel Grafo
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

