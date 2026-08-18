import React, { useState, useEffect, useRef } from "react";
import {
  Waves,
  Zap,
  Activity,
  Sliders,
  Play,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Radio,
  Clock,
  Gauge
} from "lucide-react";
import { HapticPattern } from "../types";
import { triggerHapticFeedback } from "../utils/haptics";

export const HapticPeripheralsPanel: React.FC = () => {
  const [activePattern, setActivePattern] = useState<HapticPattern>("CONFIRMATION_PULSE");
  const [frequency, setFrequency] = useState<number>(180);
  const [intensity, setIntensity] = useState<number>(0.75);
  const [durationMs, setDurationMs] = useState<number>(200);
  const [activePin, setActivePin] = useState<number>(-1);
  const [matrixState, setMatrixState] = useState<boolean[]>(new Array(16).fill(false));
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);

  // Animate tactile oscilloscope canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let phase = 0;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = "rgba(226, 232, 240, 0.8)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < w; x += 30) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = 0; y < h; y += 20) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      // PDM Waveform drawing
      ctx.strokeStyle = isSynthesizing ? "#a855f7" : "#4f46e5";
      ctx.lineWidth = 2;
      ctx.beginPath();

      const centerY = h / 2;
      const amplitude = (h / 2 - 10) * intensity * (isSynthesizing ? 1.0 : 0.4);
      const freqFactor = frequency / 20;

      for (let x = 0; x < w; x++) {
        const angle = (x / w) * Math.PI * 2 * freqFactor + phase;
        let yVal = Math.sin(angle);
        if (activePattern === "ATTENTION_WARNING") {
          yVal = Math.sign(Math.sin(angle * 1.5)) * 0.9;
        } else if (activePattern === "HEARTBEAT_RHYTHM") {
          yVal = Math.sin(angle) * Math.exp(-((x % 60) / 30));
        }

        const y = centerY - yVal * amplitude;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      phase += 0.08;
      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [frequency, intensity, activePattern, isSynthesizing]);

  // Execute a tactile pattern sequence
  const playPattern = (pattern: HapticPattern, freq = 180, dur = 200, inten = 0.75) => {
    setActivePattern(pattern);
    setFrequency(freq);
    setDurationMs(dur);
    setIntensity(inten);
    setIsSynthesizing(true);

    triggerHapticFeedback(pattern, inten, dur);

    if (pattern === "DIRECTIONAL_SWEEP") {
      for (let col = 0; col < 4; col++) {
        setTimeout(() => {
          const newArr = new Array(16).fill(false);
          for (let row = 0; row < 4; row++) {
            newArr[row * 4 + col] = true;
          }
          setMatrixState(newArr);
        }, col * 60);
      }
      setTimeout(() => {
        setMatrixState(new Array(16).fill(false));
        setIsSynthesizing(false);
      }, 300);
    } else if (pattern === "ATTENTION_WARNING") {
      const flashArr = new Array(16).fill(true);
      setMatrixState(flashArr);
      setTimeout(() => setMatrixState(new Array(16).fill(false)), 80);
      setTimeout(() => setMatrixState(flashArr), 140);
      setTimeout(() => {
        setMatrixState(new Array(16).fill(false));
        setIsSynthesizing(false);
      }, 260);
    } else if (pattern === "HEARTBEAT_RHYTHM") {
      const centerPins = [5, 6, 9, 10];
      const newArr = new Array(16).fill(false);
      centerPins.forEach(p => (newArr[p] = true));
      setMatrixState(newArr);
      setTimeout(() => setMatrixState(new Array(16).fill(false)), 100);
      setTimeout(() => {
        setMatrixState(new Array(16).fill(true));
      }, 180);
      setTimeout(() => {
        setMatrixState(new Array(16).fill(false));
        setIsSynthesizing(false);
      }, 340);
    } else {
      const newArr = new Array(16).fill(false);
      newArr[5] = true;
      newArr[6] = true;
      newArr[9] = true;
      newArr[10] = true;
      setMatrixState(newArr);
      setTimeout(() => {
        setMatrixState(new Array(16).fill(false));
        setIsSynthesizing(false);
      }, dur);
    }
  };

  const handlePinClick = (pinIdx: number) => {
    setActivePin(pinIdx);
    const newArr = [...matrixState];
    newArr[pinIdx] = !newArr[pinIdx];
    setMatrixState(newArr);
    triggerHapticFeedback("CONFIRMATION_PULSE", 0.6, 90);
  };

  return (
    <div id="haptics-bench-view" className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Left Column: 4x4 Tactile Matrix & Oscilloscope (7 cols) */}
      <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 flex flex-col shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Waves className="w-4 h-4 text-purple-600" />
              <span>Matrice Tattile Aptica & Banco Attuatori LRA</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Modulazione di densità d'impulsi (PDM) in tempo reale per feedback aptico naturale
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-purple-600" />
            <span>Broker DSP: 9092</span>
          </span>
        </div>

        {/* Tactile Matrix Array Grid (4x4) & Physical Peripherals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-2">
          {/* 4x4 Actuator Matrix */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col items-center justify-center">
            <span className="text-[11px] font-mono font-semibold text-slate-700 mb-3 block">
              MATRICE TATTILE 16 PUNTI [PIN ATTUATORI]
            </span>
            <div className="grid grid-cols-4 gap-2.5 p-2 bg-white rounded-xl border border-slate-200 shadow-2xs">
              {matrixState.map((active, idx) => (
                <button
                  key={idx}
                  onClick={() => handlePinClick(idx)}
                  className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center text-[10px] font-mono transition-all duration-150 border ${
                    active
                      ? "bg-gradient-to-br from-purple-600 to-pink-600 text-white border-purple-400 scale-105 shadow-md"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span className="font-bold">P{idx + 1}</span>
                  <span className="text-[8px] opacity-80">{active ? "ATTIVO" : "0V"}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-2.5 text-center">
              Clicca i singoli pin per inviare impulsi aptici mirati
            </p>
          </div>

          {/* Actuator Waveform Oscilloscope */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono font-semibold text-indigo-700 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-indigo-600" />
                <span>OSCILLOSCOPIO FORMA D'ONDA PDM</span>
              </span>
              <span className="text-[10px] font-mono font-semibold text-purple-700">{frequency} Hz</span>
            </div>

            <canvas
              ref={canvasRef}
              width={320}
              height={140}
              className="w-full h-36 bg-white rounded-lg border border-slate-200"
            />

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 mt-2">
              <span>AMP: {Math.round(intensity * 100)}%</span>
              <span>DUR: {durationMs}ms</span>
              <span>PWM: 48kHz</span>
            </div>
          </div>
        </div>

        {/* Preset Haptic Waveform Triggers */}
        <div className="mt-4 pt-3 border-t border-slate-200">
          <span className="text-xs font-bold text-slate-800 block mb-2">
            Preset Segnali Tattili:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => playPattern("CONFIRMATION_PULSE", 120, 150, 0.7)}
              className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 group-hover:text-indigo-600">Conferma</span>
                <Play className="w-3 h-3 text-indigo-600 opacity-0 group-hover:opacity-100" />
              </div>
              <span className="text-[10px] text-slate-500 font-mono block mt-1">120 Hz • 150ms</span>
            </button>

            <button
              onClick={() => playPattern("ATTENTION_WARNING", 240, 260, 0.95)}
              className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 group-hover:text-rose-600">Allarme Rapido</span>
                <Play className="w-3 h-3 text-rose-600 opacity-0 group-hover:opacity-100" />
              </div>
              <span className="text-[10px] text-slate-500 font-mono block mt-1">240 Hz • Doppio Burst</span>
            </button>

            <button
              onClick={() => playPattern("DIRECTIONAL_SWEEP", 160, 300, 0.8)}
              className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 group-hover:text-purple-600">Scansione Direzionale</span>
                <Play className="w-3 h-3 text-purple-600 opacity-0 group-hover:opacity-100" />
              </div>
              <span className="text-[10px] text-slate-500 font-mono block mt-1">160 Hz • Sinistra-Destra</span>
            </button>

            <button
              onClick={() => playPattern("HEARTBEAT_RHYTHM", 65, 340, 0.65)}
              className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-colors group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 group-hover:text-pink-600">Sincronia Respiro</span>
                <Play className="w-3 h-3 text-pink-600 opacity-0 group-hover:opacity-100" />
              </div>
              <span className="text-[10px] text-slate-500 font-mono block mt-1">65 Hz • 60 BPM</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Custom Haptic Synthesizer & Hardware Peripherals (5 cols) */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        {/* Parametric Haptic Synthesizer Controls */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-600" />
              <span>Sintetizzatore Aptico Parametrico</span>
            </h3>
            <button
              onClick={() => playPattern("CONFIRMATION_PULSE", frequency, durationMs, intensity)}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all shadow-xs"
            >
              <Play className="w-3 h-3" />
              <span>Invia Impulso</span>
            </button>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <div className="flex justify-between mb-1 text-slate-700 font-medium">
                <span>Frequenza di Risonanza (Hz)</span>
                <span className="font-mono text-purple-700 font-bold">{frequency} Hz</span>
              </div>
              <input
                type="range"
                min="40"
                max="350"
                step="5"
                value={frequency}
                onChange={(e) => setFrequency(Number(e.target.value))}
                className="w-full accent-purple-600"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1 text-slate-700 font-medium">
                <span>Intensità Attuatore</span>
                <span className="font-mono text-indigo-700 font-bold">{Math.round(intensity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1 text-slate-700 font-medium">
                <span>Durata Impulso (ms)</span>
                <span className="font-mono text-emerald-700 font-bold">{durationMs} ms</span>
              </div>
              <input
                type="range"
                min="50"
                max="800"
                step="25"
                value={durationMs}
                onChange={(e) => setDurationMs(Number(e.target.value))}
                className="w-full accent-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* Connected Haptic Peripheral Units */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex-1 flex flex-col shadow-xs">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-3">
            <Radio className="w-3.5 h-3.5 text-indigo-600" />
            <span>Periferiche Aptiche Connesse (Wi-Fi/Bluetooth)</span>
          </h3>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">Bracciale / Smartwatch Aptico 01</span>
                <span className="text-[10px] text-slate-500 font-mono">ID: node_haptic_band • Doppio LRA 200Hz</span>
              </div>
              <button
                onClick={() => triggerHapticFeedback("CONFIRMATION_PULSE", 0.8, 150)}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-[10px] text-slate-700 font-semibold"
              >
                Impulso
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">Cintura Matrice Tattile 02</span>
                <span className="text-[10px] text-slate-500 font-mono">ID: node_tactile_pad • Matrice 16 Pin</span>
              </div>
              <button
                onClick={() => triggerHapticFeedback("DIRECTIONAL_SWEEP", 0.9, 250)}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-[10px] text-slate-700 font-semibold"
              >
                Scansione
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">Nodo Relè Aptico Ambientale 03</span>
                <span className="text-[10px] text-slate-500 font-mono">ID: node_relay_03 • Attuatore a Solenoide</span>
              </div>
              <button
                onClick={() => triggerHapticFeedback("ATTENTION_WARNING", 1.0, 200)}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-[10px] text-slate-700 font-semibold"
              >
                Allarme
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

