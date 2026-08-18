import React, { useState, useEffect } from "react";
import {
  Network,
  Radio,
  Cpu,
  Waves,
  Activity,
  Shield,
  Zap,
  Battery,
  Plus,
  RefreshCw,
  Signal,
  CheckCircle2,
  HardDrive
} from "lucide-react";
import { EdgeNode, DuplexPacket } from "../types";
import { triggerHapticFeedback } from "../utils/haptics";

interface EdgeNodesMeshProps {
  nodes: EdgeNode[];
  onPingNode: (nodeId: string) => void;
  onAddNode: (name: string, role: any) => void;
}

export const EdgeNodesMesh: React.FC<EdgeNodesMeshProps> = ({
  nodes,
  onPingNode,
  onAddNode
}) => {
  const [selectedNode, setSelectedNode] = useState<EdgeNode | null>(nodes[0] || null);
  const [packetStream, setPacketStream] = useState<DuplexPacket[]>([]);
  const [activePacketsAnim, setActivePacketsAnim] = useState<Array<{ id: string; from: string; to: string; progress: number; type: string }>>([]);

  // Generate continuous live duplex packets for the mesh animation
  useEffect(() => {
    const interval = setInterval(() => {
      if (nodes.length < 2) return;
      const srcIdx = Math.floor(Math.random() * nodes.length);
      let dstIdx = Math.floor(Math.random() * nodes.length);
      while (dstIdx === srcIdx) {
        dstIdx = Math.floor(Math.random() * nodes.length);
      }

      const types: Array<DuplexPacket["payloadType"]> = ["VOICE_PCM", "H265_FRAME", "HAPTIC_PDM", "GRAPH_SYNC", "TELEMETRY"];
      const selectedType = types[Math.floor(Math.random() * types.length)];
      const pktId = "pkt_" + Math.random().toString(36).substring(2, 7);

      const newPacket: DuplexPacket = {
        id: pktId,
        timestamp: Date.now(),
        source: nodes[srcIdx].id,
        target: nodes[dstIdx].id,
        payloadType: selectedType,
        sizeBytes: selectedType === "H265_FRAME" ? 4820 : selectedType === "VOICE_PCM" ? 512 : 64,
        encrypted: true
      };

      setPacketStream(prev => [newPacket, ...prev.slice(0, 19)]);
      setActivePacketsAnim(prev => [...prev.slice(-6), { id: pktId, from: nodes[srcIdx].id, to: nodes[dstIdx].id, progress: 0, type: selectedType }]);
    }, 1400);

    return () => clearInterval(interval);
  }, [nodes]);

  // Animate packets progress
  useEffect(() => {
    const animInterval = setInterval(() => {
      setActivePacketsAnim(prev => 
        prev
          .map(p => ({ ...p, progress: p.progress + 0.1 }))
          .filter(p => p.progress < 1.0)
      );
    }, 60);

    return () => clearInterval(animInterval);
  }, []);

  const getNodeIcon = (role: EdgeNode["role"]) => {
    switch (role) {
      case "CENTRAL_CPU":
        return <Cpu className="w-5 h-5 text-indigo-600" />;
      case "AV_TERMINAL":
        return <Radio className="w-5 h-5 text-emerald-600" />;
      case "HAPTIC_BAND":
      case "TACTILE_ARRAY":
        return <Waves className="w-5 h-5 text-purple-600" />;
      case "QUANTIZED_NPU":
        return <HardDrive className="w-5 h-5 text-amber-600" />;
      default:
        return <Activity className="w-5 h-5 text-blue-600" />;
    }
  };

  return (
    <div id="edge-mesh-topology-view" className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Mesh Canvas & Visual Interactive Topology (7 cols) */}
      <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 flex flex-col shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Network className="w-4 h-4 text-indigo-600" />
              <span>Topologia Mesh Wi-Fi & Nodi Slave Duplex</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Host Master connesso in rete locale ai terminali di ascolto e attuatori
            </p>
          </div>
          <button
            id="btn-add-modular-node"
            onClick={() => onAddNode("Modulo Sensore 0" + (nodes.length + 1), "SENSOR_POD")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Aggiungi Nodo Slave</span>
          </button>
        </div>

        {/* 2D Mesh Graph Visualization Canvas */}
        <div className="relative w-full h-[400px] bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#cbd5e120_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e120_1px,transparent_1px)] bg-[size:24px_24px]" />

          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {nodes.map(node => {
              const centralNode = nodes.find(n => n.role === "CENTRAL_CPU") || nodes[0];
              if (node.id === centralNode.id) return null;
              return (
                <g key={node.id}>
                  <line
                    x1={`${centralNode.coordinates.x}%`}
                    y1={`${centralNode.coordinates.y}%`}
                    x2={`${node.coordinates.x}%`}
                    y2={`${node.coordinates.y}%`}
                    stroke="rgba(99, 102, 241, 0.35)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                </g>
              );
            })}

            {activePacketsAnim.map(pkt => {
              const srcNode = nodes.find(n => n.id === pkt.from);
              const dstNode = nodes.find(n => n.id === pkt.to);
              if (!srcNode || !dstNode) return null;

              const curX = srcNode.coordinates.x + (dstNode.coordinates.x - srcNode.coordinates.x) * pkt.progress;
              const curY = srcNode.coordinates.y + (dstNode.coordinates.y - srcNode.coordinates.y) * pkt.progress;

              let color = "#6366f1";
              if (pkt.type === "HAPTIC_PDM") color = "#a855f7";
              else if (pkt.type === "H265_FRAME") color = "#10b981";
              else if (pkt.type === "VOICE_PCM") color = "#0ea5e9";

              return (
                <circle
                  key={pkt.id}
                  cx={`${curX}%`}
                  cy={`${curY}%`}
                  r="5"
                  fill={color}
                />
              );
            })}
          </svg>

          {nodes.map(node => {
            const isSelected = selectedNode?.id === node.id;
            const isCentral = node.role === "CENTRAL_CPU";

            return (
              <div
                key={node.id}
                onClick={() => {
                  setSelectedNode(node);
                  triggerHapticFeedback("CONFIRMATION_PULSE", 0.4, 60);
                }}
                style={{
                  left: `${node.coordinates.x}%`,
                  top: `${node.coordinates.y}%`,
                  transform: "translate(-50%, -50%)"
                }}
                className={`absolute cursor-pointer transition-all duration-300 flex flex-col items-center group z-10`}
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center p-0.5 transition-all ${
                    isSelected
                      ? "ring-2 ring-indigo-600 scale-110 shadow-md"
                      : "hover:scale-105"
                  } ${
                    isCentral
                      ? "bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-md"
                      : "bg-white border border-slate-300 hover:border-slate-400"
                  }`}
                >
                  <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                    {getNodeIcon(node.role)}
                  </div>
                </div>

                <div className="mt-1.5 px-2 py-0.5 rounded-full bg-white/90 border border-slate-300 text-[10px] font-semibold text-slate-800 text-center whitespace-nowrap shadow-2xs">
                  {node.name}
                </div>

                <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1 rounded mt-0.5 font-semibold border border-emerald-200">
                  {node.latencyMs}ms • {node.signalDbm}dBm
                </span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              Frame Voce PCM
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Pacchetto Video H.265
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              Attuazione Aptica
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">Slot TDMA: 2.0ms</span>
        </div>
      </div>

      {/* Right Column: Selected Node Telemetry & Duplex Packet Log (5 cols) */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        {selectedNode ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-slate-100 text-indigo-600">
                  {getNodeIcon(selectedNode.role)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{selectedNode.name}</h3>
                  <span className="text-[11px] font-mono text-indigo-600 font-semibold">{selectedNode.id}</span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                {selectedNode.status === "ACTIVE" ? "ATTIVO" : selectedNode.status}
              </span>
            </div>

            {/* Specs Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Frequenza Canale</span>
                <span className="font-semibold text-slate-900 font-mono">{selectedNode.frequency}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Latenza Mesh</span>
                <span className="font-semibold text-emerald-700 font-mono">{selectedNode.latencyMs} ms</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Segnale RSSI</span>
                <span className="font-semibold text-slate-900 font-mono">{selectedNode.signalDbm} dBm (98%)</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Batteria</span>
                <span className="font-semibold text-slate-900 font-mono">{selectedNode.batteryPct}%</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 col-span-2 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-mono">Tunnel Cifrato</span>
                  <span className="font-semibold text-indigo-700 font-mono">{selectedNode.encryption}</span>
                </div>
                <Shield className="w-4 h-4 text-indigo-600" />
              </div>
            </div>

            {/* Node Actions */}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => onPingNode(selectedNode.id)}
                className="flex-1 py-2 px-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Invia Ping Wi-Fi</span>
              </button>
              <button
                onClick={() => triggerHapticFeedback("CONFIRMATION_PULSE", 0.8, 150)}
                className="py-2 px-3 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Test Attuatore</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-500 text-xs shadow-xs">
            Seleziona un'unità edge dalla topologia mesh per ispezionarne la telemetria.
          </div>
        )}

        {/* Live Encrypted Duplex Packet Stream */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex-1 flex flex-col shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-600" />
              <span>Log Pacchetti Duplex Cifrati</span>
            </h3>
            <span className="text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              IN TEMPO REALE
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-56 space-y-1.5 pr-1 font-mono text-[11px]">
            {packetStream.map((pkt) => (
              <div
                key={pkt.id}
                className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between hover:border-slate-300"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    pkt.payloadType === "HAPTIC_PDM" ? "bg-purple-500" :
                    pkt.payloadType === "H265_FRAME" ? "bg-emerald-500" : "bg-indigo-500"
                  }`} />
                  <span className="text-slate-800 font-semibold">{pkt.payloadType}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <span>{pkt.source} → {pkt.target}</span>
                  <span className="text-indigo-600 font-bold">{pkt.sizeBytes}B</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

